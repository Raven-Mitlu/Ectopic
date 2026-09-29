const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Stockage de toutes les sessions actives
// Format attendu : { "1234": { question: "...", reponses: { "Alice": ["Msg1"] } } }
let sessions = {};

// Fonction pour générer un code à 4 chiffres (ex: 4821)
function genererCodeSession() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

io.on('connection', (socket) => {
    console.log('Un utilisateur est connecté');

    // --- ACTIONS DU PRÉSENTATEUR ---
    socket.on('creer_session', (questionSaisie) => {
        const codeSession = genererCodeSession();
        
        // On initialise la nouvelle session
        sessions[codeSession] = {
            question: questionSaisie,
            reponses: {}
        };
        
        // Le présentateur rejoint la "salle" virtuelle de sa session
        socket.join(codeSession);
        
        // On lui renvoie le code généré pour qu'il le partage
        socket.emit('session_creee', codeSession);
    });

    // --- ACTIONS DU PARTICIPANT ---
    socket.on('rejoindre_session', (donnees, callback) => {
        const codeSession = donnees.codeSession;

        // On vérifie si la session existe bien
        if (sessions[codeSession]) {
            // Le participant rejoint la salle
            socket.join(codeSession);
            
            // On lui envoie la question de CETTE session
            socket.emit('question', sessions[codeSession].question);
            
            // On confirme à la page web que la connexion a réussi
            callback({ succes: true });
        } else {
            // On renvoie une erreur
            callback({ succes: false, message: "Code de session introuvable." });
        }
    });

    socket.on('nouvelle_reponse', (donnees) => {
        const codeSession = donnees.codeSession;
        const nomParticipant = donnees.nom;
        const texteDeLaReponse = donnees.texte;

        // Sécurité : on vérifie que la session existe toujours
        if (sessions[codeSession]) {
            if (!sessions[codeSession].reponses[nomParticipant]) {
                sessions[codeSession].reponses[nomParticipant] = [];
            }
            
            sessions[codeSession].reponses[nomParticipant].push(texteDeLaReponse);
            
            // On met à jour UNIQUEMENT les personnes dans cette salle (le présentateur)
            io.to(codeSession).emit('mise_a_jour_reponses', sessions[codeSession].reponses);
        }
    });

    socket.on('disconnect', () => {
        console.log('Un utilisateur s\'est déconnecté');
    });
});

server.listen(3000, () => {
    console.log('Serveur démarré sur http://localhost:3000');
});
