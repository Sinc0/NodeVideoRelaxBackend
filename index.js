// const { time } = require('console');
// const cors = require('cors')
const express = require('express');
const app = express(); // app.use(cors())
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const SocketServer = new Server(server, {  
    cors: {    
        // origin: "http://localhost:3000",    
        // methods: ["GET", "POST"] 
        // origins: ["*"],
        handlePreflightRequest: (req, res) => {
            res.writeHead(200, {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                // "Access-Control-Allow-Headers": "*",
                // "Access-Control-Allow-Credentials": true
            });
            
            res.end()
        }
    }
});

//endpoint
// app.get('/*', (req, res) => {
//       res.sendFile(__dirname + '/index.html');
// });

//port
let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
server.listen(port, () => {     
    console.log('listening on *:' + port);
});

//variables
serverUsers = []

//create namespaces
// const adminNamespace = SocketServer.of("/admin");

//all namespaces
let nsps = SocketServer._nsps
let all_namespaces = Array.from(nsps, ([namespace]) => ({ type: 'namespace', namespace}));
// console.log(SocketServer._nsps)
// console.log(all_namespaces)

// SocketServer.of("/admin").on("connection", (socket) => {
    // console.log(socket.nsp.name)

    // const newNamespace = socket.nsp; // newNamespace.name === "/dynamic-101"
    // broadcast to all clients in the given sub-namespace  
    // newNamespace.emit("hello");
// });

SocketServer.of("/").on('connection', (client) => {
    //variables
    var socketId = client.id
    var clientIp = client.client.conn.remoteAddress
    var clientNsp = client.nsp.name
    // var totalClients = client.server.httpServer._connections
    
    //used to refresh info on screen
    function updateInfo(client)
    {
        // console.log("update info")
        
        //variables
        let rooms = client.adapter.rooms
        let clients = client.adapter.sids
        let allClients = Array.from(clients, ([client]) => ({ type: 'client', client }));
        let allRooms = Array.from(rooms, ([room, clients]) => ({type: 'room', room, clients: Array.from(clients) }))
        let allRoomsFormatted = []
        let yourRooms = Array.from(client.rooms)
        let clientNames = serverUsers
        let clientsAllJSON = []
        let clientsAll = (Array.from(clients))

        //debugging
        // console.log("all clients " + "(" + allClients.length.toString() + ")")
        // console.log(allClients)

        //sort client names
        for(c in clientsAll)
        {
            let count = (parseInt(c) + 1).toString()
            let type = "type=client"
            let clientFormatted = Array.from(clientsAll[c][1])
            let clientStringified = clientFormatted.toString()
            let clientStringifiedSplit = clientStringified.split(",")
            let clientId = clientStringifiedSplit[0]
            let clientName = ""

            //handle client username
            for(u in serverUsers)
            {
                let user = serverUsers[u]
                // console.log(JSON.parse("{" + serverUsers[u] + "}"))
                // console.log(JSON.parse(serverUsers[u]))
                // console.log(JSON.parse(serverUsers[u]).username)
                if(user.socketId == clientId)
                {
                    clientName = user.username
                    console.log("clientName: " + clientName)

                    //debugging
                    // console.log("clientName: " + clientName)
                    // console.log("new username: " + clientName)

                    break
                }
            }

            //update client list
            clientRoom = clientStringifiedSplit[1]
            if(clientRoom == null)
            {
                clientRoom = ""
            }
            clientJSON = "{" + "\"type\"" + ":" + "\"client\"" + "," + "\"namespace\"" + ":" + "\"" + clientNsp + "\"" + "," + "\"id\"" + ":" + "\"" + clientId + "\"" + "," + "\"room\"" + ":" + "\"" + clientRoom + "\"" + "," + "\"name\""+ ":" + "\"" + clientName + "\"" + "}"
            clientJSON = JSON.parse(clientJSON)
            clientsAllJSON.push(clientJSON)
        }

        //remove client rooms from rooms list
        for(r in allRooms)
        {
            if(allRooms[r].room != allRooms[r].clients)
            {
                
                // console.log(allRooms[r])
                allRoomsFormatted.push(allRooms[r])
            }
        }

        //send socket info message
        SocketServer.emit('info', allRoomsFormatted, allClients, all_namespaces, clientsAllJSON);
    }

    //set default client name
    let clientName = "anon" + client.id.substring(0, 4).toUpperCase()
    let clientId = client.id
    
    //set default client channel
    client.join("general")

    //send socket join room message
    SocketServer.sockets.in("general").emit('join room', clientName + " joined the room")

    //debugging
    // console.log('user connected' + " / " + socketId + " / " + clientIp + " / " + clientNsp);
    // console.log('total clients: ' + totalClients)
    // console.log("rooms")
    // console.log(client.adapter.rooms)
    // console.log("sids")
    // console.log(client.adapter.sids)
    // console.log("nsp")
    // console.log(client.adapter.nsp.name)

    //handle socket chat message
    client.on('chat message', (msgObj) => {
        // console.log("\nchat message")

        //handle client username
        for (u in serverUsers)
        {
            let user = serverUsers[u]

            if(user.socketId == msgObj.userId)
            {
                msgObj.userName = user.username
                
                //debugging
                // console.log("clientName: " + clientName)
                // console.log("new username: " + clientName)

                break
            }
        }

        //debugging
        // console.log("message content: " +  msgObj.content);
        // console.log("message room: " + msgObj.room);
        // console.log("message userId: " + msgObj.userId);
        // console.log("message userName: " + msgObj.userName);
        // console.log("total saved users (serverUsers) "  + serverUsers.length)
        // console.log(serverUsers)

        //send socket chat message to specific room        
        SocketServer.sockets.in(msgObj.room).emit('chat message', msgObj)
    });
        
    //handle socket leave room message
    client.on('leave room', (msg) => {
        // console.log("\nleave room")

        //leave socket room
        client.leave(msg)

        //debugging
        // console.log(client.adapter.rooms)
        // console.log(client.adapter.rooms)

        //refresh info on
        updateInfo(client)

        //handle client username
        for(u in serverUsers)
        {
            let user = serverUsers[u]

            if(user.socketId == clientId)
            {
                clientName = user.username

                //debugging
                // console.log("clientName: " + clientName)
                // console.log("new username: " + clientName)

                break
            }
        }

        //send socket leave room message
        SocketServer.sockets.in(msg).emit('leave room', clientName + " left the room")
    });

    //handle socket join room message
    client.on('join room', (msg) => {
        // console.log(msg)
        // console.log("\njoin room")

        //variables
        let newRoom = msg[0]
        let oldRoom = msg[1]

        //leave old socket room and join new socket room
        client.leave(oldRoom)
        client.join(newRoom)

        //debugging
        // console.log(client.adapter.rooms)
        // console.log(client.adapter.rooms);

        //refresh info on screen
        updateInfo(client)

        //handle client username
        for(u in serverUsers)
        {
            let user = serverUsers[u]

            if(user.socketId == clientId)
            {
                clientName = user.username

                //debugging
                // console.log("clientName: " + clientName)
                // console.log("new username: " + clientName)

                break
            }
        }

        //send socket message leave room and send socket message join room
        SocketServer.sockets.in(oldRoom).emit('leave room', clientName + " left the room")
        SocketServer.sockets.in(newRoom).emit('join room', clientName + " joined the room")
    });

    //handle socket create room message
    client.on('create room', (msg) => {
        // console.log(msg)

        //variables
        let newRoom = msg[0]
        let oldRoom = msg[1]
        
        //check for forbidden characters
        newRoom = newRoom.replace(",", "")
        
        //leave old socket room and join new socket room
        client.leave(oldRoom)
        client.join(newRoom)
        
        //debugging
        // console.log("\ncreate room")
        // console.log("newRoom: " + newRoom)
        // console.log("oldRoom: " + oldRoom)
        // console.log(client.adapter.rooms)
        // console.log(client.adapter.rooms)
        
        //handle client username
        for(u in serverUsers)
        {
            let user = serverUsers[u]

            if(user.socketId == clientId)
            {
                clientName = user.username

                //debugging
                // console.log("clientName: " + c   lientName)
                // console.log("new username: " + clientName)

                break
            }
        }
        
        //refresh info on screen
        updateInfo(client)
        
        //send leave room, create room and join room socket message
        SocketServer.sockets.in(oldRoom).emit('leave room', clientName + " left the room")
        SocketServer.sockets.in(newRoom).emit('create room', newRoom + " room created")
        SocketServer.sockets.in(newRoom).emit('join room', clientName + " joined the room")
    });
    
    //handle socket disconnect message
    client.on('disconnect', () => {
        // console.log('user disconnected');

        //refresh info on screen
        updateInfo(client)
    });

    //handle socket add user message
    client.on('add user', (userObj) => {
        // console.log("\nadd username")
        // console.log(userObj)

        //variables
        let userId = userObj.socketId
        let userName = userObj.username
        let userIp = client.client.conn.remoteAddress

        //update userObj
        userObj = JSON.stringify(userObj)
        userObj = userObj.replace("}", "")
        userObj = userObj.replace("{", "")
        userObj += "," + "\"ipAddress\"" + ":" + "\"" + userIp + "\""
        userObj = "{" + userObj + "}"
        userObj = JSON.parse(userObj)
        
        //debugging
        // console.log("user id: " + userId)
        // console.log("username: " + userName)
        // console.log("userIp: " + userIp)

        //handle client username
        if(serverUsers.length == 0)
        {
            serverUsers.push(userObj) //update serverUsers
        }
        else if(serverUsers.length > 0)
        {
            for(u in serverUsers)
            {
                let user = serverUsers[u]
                
                //update user name if existing user
                if(userId == user.socketId)
                {
                    user.username = userName                    
                }
                //update serverUsers if new user
                else if(!JSON.stringify(serverUsers).includes(userObj.socketId))
                {           
                    serverUsers.push(userObj)
                }

            }
        }
            
        
        //debugging
        console.log(serverUsers)
        
        //refresh info on screen
        updateInfo(client)
    })
    
    //refresh info on screen
    updateInfo(client)
    
    //debugging
    // console.log(allClients)
    // console.log(allRooms)
});
