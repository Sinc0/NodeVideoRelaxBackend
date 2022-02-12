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
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Credentials": true
            });
            
            res.end()
        }
    }
});
const playlistsJSON = require('./playlists.json')

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
var serverUsers = []
var serverRooms = []
var videosCurrentlyPlaying = []
var serverAdmins = []
var serverDefaultPlaylists = []

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

function randomPlaylist(category)
{
    let randomNumber = Math.floor(Math.random() * 3);
    // console.log("randomNumber: " + randomNumber)

    // print all databases
    playlistsJSON.forEach(obj => {
        if(obj.category == category)
        {
            pl = obj.urls[randomNumber]
        }
    });
    
    return pl
}

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
        SocketServer.emit('info', allRoomsFormatted, allClients, all_namespaces, clientsAllJSON, videosCurrentlyPlaying, JSON.stringify(playlistsJSON));

        //update server rooms
        serverRooms = allRoomsFormatted
    }

    //set default client name
    let clientName = "anon" + client.id.substring(0, 4).toUpperCase()
    let clientId = client.id
    
    //set default client channel
    client.join("temp")
    // SocketServer.sockets.in("temp").emit('join room', clientName + " joined the room") //send socket join room message

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
    // client.on('leave room', (msg) => {
    //     // console.log("\nleave room")

    //     //leave socket room
    //     client.leave(msg)

    //     //debugging
    //     // console.log(client.adapter.rooms)
    //     // console.log(client.adapter.rooms)

    //     //refresh info on
    //     updateInfo(client)

    //     //handle client username
    //     for(u in serverUsers)
    //     {
    //         let user = serverUsers[u]

    //         if(user.socketId == clientId)
    //         {
    //             clientName = user.username

    //             //debugging
    //             // console.log("clientName: " + clientName)
    //             // console.log("new username: " + clientName)

    //             break
    //         }
    //     }

    //             //create msgs
    //             let msgLeftRoom = {content: " left the room", room: newRoom, userId: client.id, userName: clientName.substr(4)}

    //     //send socket leave room message
    //     SocketServer.sockets.in(msg).emit('leave room', msg)
    // });

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
        
        //create msgs
        let msgLeftRoom = {content: " left the room", room: newRoom, userId: client.id, userName: clientName.substr(4)}
        let msgJoinRoom = {content: " joined the room", room: newRoom, userId: client.id, userName: clientName.substr(4)}
        
        //send socket message leave room and send socket message join room
        SocketServer.sockets.in(oldRoom).emit('leave room', msgLeftRoom)
        SocketServer.sockets.in(newRoom).emit('join room', msgJoinRoom)
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
        
        //create msgs
        let msgLeftRoom = {content: " left the room", room: newRoom, userId: client.id, userName: clientName.substr(4)}
        let msgCreateRoom = {content: " created room " + newRoom, room: newRoom, userId: client.id, userName: clientName.substr(4)}
        
        //send socket message leave room and send socket message join room
        SocketServer.sockets.in(oldRoom).emit('leave room', msgLeftRoom)
        SocketServer.sockets.in(newRoom).emit('create room', msgCreateRoom)
    });
    
    //handle socket disconnect message
    client.on('disconnect', () => {
        // console.log('user disconnected');

        //variables
        let clientRooms = Array.from(client.adapter.rooms, ([room]) => ({room}))
        let disconnectRoom = clientRooms[1]

        //null check
        if(disconnectRoom != null)
        {
            //create msgs
            let msgLeftRoom = {content: " left the room", room: disconnectRoom, userId: client.id, userName: clientName.substr(4)}
    
            //send socket leave room message
            SocketServer.sockets.in(clientRooms[1].room).emit('leave room', msgLeftRoom)
        }

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

    client.on('video command', (msgObj) => {
        //debugging
        // console.log("\nvideo command")
        // console.log(msgObj)

        //variables
        var content = null
        var room = null
        var userId = null
        var userName = null
        var playingVideosLastWholeSecond = null
        var playingVideoId = null
        var videoPlaying = null

        content = msgObj.content
        room = msgObj.room
        userId = msgObj.userId
        userName = msgObj.userName
        playingVideosLastWholeSecond = msgObj.playingVideosLastWholeSecond
        playingVideoId = msgObj.playingVideoId
        videoPlaying = msgObj.videoPlaying
        playlistCurrentVideoIndex = msgObj.playlistCurrentVideoIndex
        videoPlaylist = msgObj.videoPlaylist
        videoPlaylistId = msgObj.videoPlaylistId
        syncMaster = msgObj.syncMaster

        //create json obj
        // rd = "\"room\"" + ":" + "\"" + room + "\"" + "," + "\"videoId\"" + ":" + "\"" + playingVideoId + "\"" + "," + "\"lastWholeSecond\"" + ":" + playingVideosLastWholeSecond + "," + "\"id\"" + ":" + "\"" + room + playingVideoId + "\"" + "," + "\"videoPlaying\"" + ":" + "\"" + videoPlaying + "\""
        // rd = JSON.parse("{" + rd + "}")

        // if(msgObj.content == "resync video")
        // {
        //     SocketServer.sockets.in(msgObj.room).emit('video command', msgObj)
        // }
        // if(msgObj.content == "next video")  
        // {
        //     //send socket chat message to specific room        
        //     SocketServer.sockets.in(msgObj.room).emit('video command', msgObj)
        // }
        // else if(msgObj.content == "previous video")
        // {
        //     //send socket chat message to specific room        
        //     SocketServer.sockets.in(msgObj.room).emit('video command', msgObj)
        // }
        // else if(msgObj.content == "sync video")
        // {
        //     //send socket chat message to specific room        
        //     SocketServer.sockets.in(msgObj.room).emit('video command', msgObj)
        // }

        if(msgObj.content == "resync2 video")
        {
            for(roomObj in videosCurrentlyPlaying)
            {
                if(videosCurrentlyPlaying[roomObj].room == room)
                {
                    msgObj.playingVideosLastWholeSecond = videosCurrentlyPlaying[roomObj].lastWholeSecond
                    msgObj.videoPlaying = videosCurrentlyPlaying[roomObj].videoPlaying
                    SocketServer.sockets.in(msgObj.room).emit('video command', msgObj)
                    break
                }
            }
        }

        else if(msgObj.content == "random playlist")
        {
            console.log("random playlist")
            
            let category = msgObj.room
            let newPlaylist = randomPlaylist(category)
            
            console.log(msgObj)
            msgObj.lastWholeSecond = 0
            msgObj.videoPlaying = false
            msgObj.videoId = null
            msgObj.playlistCurrentVideoIndex = 0 
            msgObj.videoPlaylist = true
            msgObj.videoPlaylistId = newPlaylist

            //send socket chat message to specific room        
            SocketServer.sockets.in(msgObj.room).emit('video command', msgObj)
        }
        
        else if(msgObj.content == "load video")
        {
            // room = msgObj.room
            // playingVideoId = msgObj.playingVideoId

            for(roomObj in videosCurrentlyPlaying)
            {
                if(videosCurrentlyPlaying[roomObj].room == room)
                {
                    videosCurrentlyPlaying[roomObj].lastWholeSecond = 0
                    videosCurrentlyPlaying[roomObj].videoPlaying = false
                    videosCurrentlyPlaying[roomObj].videoId = playingVideoId
                    videosCurrentlyPlaying[roomObj].playlistCurrentVideoIndex = msgObj.playlistCurrentVideoIndex
                    videosCurrentlyPlaying[roomObj].videoPlaylist = msgObj.videoPlaylist
                    videosCurrentlyPlaying[roomObj].videoPlaylistId = msgObj.videoPlaylistId
                    videosCurrentlyPlaying[roomObj].syncMaster = msgObj.syncMaster
                }
            }
            // console.log(videosCurrentlyPlaying.length)
            // console.log(JSON.stringify(videosCurrentlyPlaying))

            //send socket chat message to specific room        
            SocketServer.sockets.in(msgObj.room).emit('video command', msgObj)
        }
        else if(msgObj.content != "load video")
        {
            //variables
            // content = msgObj.content
            // room = msgObj.room
            // userId = msgObj.userId
            // userName = msgObj.userName
            // playingVideosLastWholeSecond = msgObj.playingVideosLastWholeSecond
            // playingVideoId = msgObj.playingVideoId
            // videoPlaying = msgObj.videoPlaying
            rd = "\"room\"" + ":" + "\"" + room + "\"" + "," + "\"videoId\"" + ":" + "\"" + playingVideoId + "\"" + "," + "\"lastWholeSecond\"" + ":" + playingVideosLastWholeSecond + "," + "\"id\"" + ":" + "\"" + room + playingVideoId + "\"" + "," + "\"videoPlaying\"" + ":" + "\"" + videoPlaying + "\"" + "," + "\"syncMaster\"" + ":" + "\"" + syncMaster + "\""
            rd = JSON.parse("{" + rd + "}")
            // rd = "," + "\"lastWholeSecond\"" + ":" + playingVideosLastWholeSecond
            
            // console.log("total server rooms: " + serverRooms.length)
            // console.log(serverRooms)
            // console.log(msgObj)
            
            let roomName = "\"" + "room" + "\"" + ":" + "\"" + room + "\""
            let newVideosCurrentlyPlaying = []
            
            if(videosCurrentlyPlaying.length == 0) //update currently playing videos metadata
            {
                videosCurrentlyPlaying.push(rd)
            }
            else if(videosCurrentlyPlaying.length > 0)
            {
                if(JSON.stringify(videosCurrentlyPlaying).includes(roomName))
                {
                    for(roomObj in videosCurrentlyPlaying)
                    {
                        if(videosCurrentlyPlaying[roomObj].room == room)
                        {
                            videosCurrentlyPlaying[roomObj].lastWholeSecond = playingVideosLastWholeSecond
                            videosCurrentlyPlaying[roomObj].videoPlaying = videoPlaying
                            videosCurrentlyPlaying[roomObj].videoId = playingVideoId
                            videosCurrentlyPlaying[roomObj].playlistCurrentVideoIndex = msgObj.playlistCurrentVideoIndex
                            videosCurrentlyPlaying[roomObj].videoPlaylist = msgObj.videoPlaylist
                            videosCurrentlyPlaying[roomObj].videoPlaylistId = msgObj.videoPlaylistId
                            videosCurrentlyPlaying[roomObj].syncMaster = msgObj.syncMaster
                        }
                    }
                }
                else if(!JSON.stringify(videosCurrentlyPlaying).includes(roomName))
                {
                    videosCurrentlyPlaying.push(rd)
                }
            }
            
            //filter out inactive rooms
            for(let v in videosCurrentlyPlaying)
            {
                for(let r in serverRooms)
                {
                    if(videosCurrentlyPlaying[v].room == serverRooms[r].room)
                    {
                        newVideosCurrentlyPlaying.push(videosCurrentlyPlaying[v])
                    }
                }
            }

            //print active rooms
            for(let v in newVideosCurrentlyPlaying)
            {
                let obj = newVideosCurrentlyPlaying[v]
                console.log("video command: " + "room = " + obj.room + " / " + "lastWholeSecond: " + obj.lastWholeSecond + " / " + "syncMaster = " + obj.syncMaster + " / " + "video index = " + obj.playlistCurrentVideoIndex + " / " + "playlist id = " + obj.videoPlaylistId)
            }

            //update videosCurrentlyPlaying
            videosCurrentlyPlaying = newVideosCurrentlyPlaying

            // console.log("video command: " + "room = " + videosCurrentlyPlaying[v].room + " / " + "lastWholeSecond: " + videosCurrentlyPlaying[v].lastWholeSecond + " / " + "syncMaster = " + videosCurrentlyPlaying[v].syncMaster + " / " + "video index = " + videosCurrentlyPlaying[v].playlistCurrentVideoIndex + " / " + "playlist id = " + videosCurrentlyPlaying[v].videoPlaylistId)
            console.log("videosCurrentlyPlaying: " + videosCurrentlyPlaying.length)
            console.log("newVideosCurrentlyPlaying: " + newVideosCurrentlyPlaying.length)
            console.log("")
                
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
            SocketServer.sockets.in(msgObj.room).emit('video command', msgObj)
        }

    });
    
    //refresh info on screen
    updateInfo(client)
    
    //debugging
    // console.log(allClients)
    // console.log(allRooms)
});
