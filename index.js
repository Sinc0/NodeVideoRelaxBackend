//includes
const express = require('express')
const app = express()
const http = require('http')
const server = http.createServer(app)
const { Server } = require("socket.io")
const playlistsJSON = require('./playlists.json')
// const { time } = require('console')
// const cors = require('cors')


//variables
const defaultRooms = []
var customUsernames = []
var serverRooms = []
var serverTotalUsers = null
var serverUsersList = []
var videosCurrentlyPlaying = []
var serverAdmins = []
var serverDefaultPlaylists = []
let port = process.env.PORT


//set port
if (port == null || port == "") { port = 3000 }


//start server
server.listen(port, () => { console.log('listening on *:' + port) })


//create socket server
const SocketServer = new Server(server, { 
    //set cors 
    cors: { 
        //cors settings
        // origin: "http://localhost:3000",    
        // methods: ["GET", "POST"] 
        // origins: ["*"],

        handlePreflightRequest: (req, res) => { 
            res.writeHead(200, { 
                "Access-Control-Allow-Origin": "*", 
                "Access-Control-Allow-Methods": "GET",
                // "Access-Control-Allow-Headers": "*",
                // "Access-Control-Allow-Credentials": true
            })
            
            res.end()
        }
    }
})


//set default room
for(let c in playlistsJSON)
{
    //debugging
    // console.log(playlistsJSON[c].category)

    //add room category to array
    defaultRooms.push(playlistsJSON[c].category)
}


//set namespaces
let nsps = SocketServer._nsps
let all_namespaces = Array.from(nsps, ([namespace]) => ({ type: 'namespace', namespace}))


//functions
function randomPlaylist(category)
{
    //variables
    let numberOfPlaylistsPerCategory = 3
    let randomNumber = Math.floor(Math.random() * numberOfPlaylistsPerCategory)

    //set random playlist
    playlistsJSON.forEach(obj => { 
        if(obj.category == category) { pl = obj.urls[randomNumber] }
    })
    
    //return value
    return pl
}


//handle socket traffic
SocketServer.of("/").on('connection', (client) => {
    //variables
    var socketId = client.id
    var clientIp = client.client.conn.remoteAddress
    var clientNsp = client.nsp.name
    // var totalClients = client.server.httpServer._connections
    

    //used to refresh info
    function updateInfo(client)
    {
        //variables
        let rooms = client.adapter.rooms
        let clients = client.adapter.sids
        let clientsAll = (Array.from(clients))
        let allClients = Array.from(clients, ([client]) => ({ type: 'client', client }))
        let allRooms = Array.from(rooms, ([room, clients]) => ({type: 'room', room, clients: Array.from(clients) }))
        let allRoomsFormatted = []
        //let yourRooms = Array.from(client.rooms)
        let clientsAllJSON = []
        //let clientNames = customUsernames
        
        //set total users arrays
        serverTotalUsers = clientsAll.length
        serverUsersList = clientsAll

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
            for(let u in customUsernames)
            {
                //debugging
                // console.log(JSON.parse("{" + customUsernames[u] + "}"))
                // console.log(JSON.parse(customUsernames[u]))
                // console.log(JSON.parse(customUsernames[u]).username)
                
                if(customUsernames[u].socketId == clientId)
                {
                    //set client name
                    clientName = customUsernames[u].username
                    
                    //debugging
                    console.log("clientName: " + clientName)

                    //return value
                    break
                }
            }

            //set client room
            clientRoom = clientStringifiedSplit[1]
            if(clientRoom == null) { clientRoom = "" }

            //set client obj
            clientJSON = "{" + "\"type\"" + ":" + "\"client\"" + "," + "\"namespace\"" + ":" + "\"" + clientNsp + "\"" + "," + "\"id\"" + ":" + "\"" + clientId + "\"" + "," + "\"room\"" + ":" + "\"" + clientRoom + "\"" + "," + "\"name\""+ ":" + "\"" + clientName + "\"" + "}"
            clientJSON = JSON.parse(clientJSON)
            
            //update client list
            clientsAllJSON.push(clientJSON)
        }

        //remove personal client rooms from rooms list
        for(r in allRooms)
        {
            if(allRooms[r].room != allRooms[r].clients)
            {
                allRoomsFormatted.push(allRooms[r])
            }
        }
        
        //send socket message
        SocketServer.emit('info', allRoomsFormatted, allClients, all_namespaces, clientsAllJSON, videosCurrentlyPlaying, JSON.stringify(playlistsJSON), defaultRooms)

        //update server rooms
        serverRooms = allRoomsFormatted
    }


    //set client id
    let clientId = client.id

    //set client username
    let clientName = "anon" + client.id.substring(0, 4).toUpperCase()

    //join temp room
    client.join("temp") 
    // SocketServer.sockets.in("temp").emit('join room', clientName + " joined the room") 

    //debugging
    // console.log('user connected' + " / " + socketId + " / " + clientIp + " / " + clientNsp)
    // console.log('total clients: ' + totalClients)
    // console.log("rooms")
    // console.log(client.adapter.rooms)
    // console.log("sids")
    // console.log(client.adapter.sids)
    // console.log("nsp")
    // console.log(client.adapter.nsp.name)


    //on socket chat message
    client.on('chat message', (msgObj) => {
        //handle client username
        for (let u in customUsernames)
        {
            //set custom username if exists
            if(customUsernames[u].socketId == msgObj.userId) 
            { 
                msgObj.userName = customUsernames[u].username
                break 
            }
        }

        //debugging
        // console.log("message content: " +  msgObj.content)
        // console.log("message room: " + msgObj.room)
        // console.log("message userId: " + msgObj.userId)
        // console.log("message userName: " + msgObj.userName)

        //send socket message   
        SocketServer.sockets.in(msgObj.room).emit('chat message', msgObj)
    })


    //on socket join room message
    client.on('join room', (msg) => {
        //variables
        let newRoom = msg[0]
        let oldRoom = msg[1]

        //null check
        // if(newRoom == "null" || newRoom == null)
        // {
        //     newRoom = "general"
        // }

        //leave old socket room and join new socket room
        client.leave(oldRoom)
        client.join(newRoom)

        //debugging
        // console.log(client.adapter.rooms)
        // console.log(client.adapter.rooms)

        //refresh info on screen
        updateInfo(client)

        //handle client username
        for(let u in customUsernames)
        {
            //set username
            if(customUsernames[u].socketId == clientId) 
            { 
                clientName = customUsernames[u].username
                break 
            }
        }
        
        //create socket messages
        let msgLeftRoom = {content: " left the room", room: newRoom, userId: client.id, userName: clientName }
        let msgJoinRoom = {content: " joined the room", room: newRoom, userId: client.id, userName: clientName }
        
        //send socket messages
        SocketServer.sockets.in(oldRoom).emit('leave room', msgLeftRoom)
        SocketServer.sockets.in(newRoom).emit('join room', msgJoinRoom)
    })


    //on socket leave room message
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
    //     for(u in customUsernames)
    //     {
    //         let user = customUsernames[u]

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
    //             let msgLeftRoom = {content: " left the room", room: newRoom, userId: client.id, userName: clientName }

    //     //send socket message
    //     SocketServer.sockets.in(msg).emit('leave room', msg)
    // })


    //on socket create room message
    client.on('create room', (msg) => {
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
        
        //handle client username
        for(let u in customUsernames)
        {
            //set custom username if exists
            if(customUsernames[u].socketId == clientId) 
            { 
                clientName = customUsernames[u].username
                break 
            }
        }
        
        //refresh info on screen
        updateInfo(client)
        
        //create msgs
        let msgLeftRoom = {content: " left the room", room: newRoom, userId: client.id, userName: clientName }
        let msgCreateRoom = {content: " created room " + newRoom, room: newRoom, userId: client.id, userName: clientName }
        
        //send socket messages
        SocketServer.sockets.in(oldRoom).emit('leave room', msgLeftRoom)
        SocketServer.sockets.in(newRoom).emit('create room', msgCreateRoom)
    })
    

    //on socket disconnect message
    client.on('disconnect', () => {
        //variables
        let clientRooms = Array.from(client.adapter.rooms, ([room]) => ({room}))
        let disconnectRoom = clientRooms[1]
        
        //debugging
        //console.log(client.adapter.rooms)

        //null check
        if(disconnectRoom != null)
        {
            //create msgs
            let msgLeftRoom = {content: " left the room", room: disconnectRoom, userId: client.id, userName: clientName }
    
            //send socket message
            SocketServer.sockets.in(clientRooms[1].room).emit('leave room', msgLeftRoom)
        }

        //refresh info on screen
        updateInfo(client)
    })


    //on socket add username message
    client.on('add username', (userObj) => {
        //debugging
        //console.log(JSON.stringify(userObj))
        
        let userIp = client.client.conn.remoteAddress

        //set user obj
        userObj = JSON.stringify(userObj)
        userObj = userObj.replace("}", "")
        userObj = userObj.replace("{", "")
        userObj += "," + "\"ipAddress\"" + ":" + "\"" + userIp + "\""
        userObj = "{" + userObj + "}"
        userObj = JSON.parse(userObj)
        
        let userId = userObj.socketId
        let userName = userObj.username

        //null check
        if(customUsernames.length == 0)
        {
            //update custom usernames
            customUsernames.push(userObj) 
        }
        else if(customUsernames.length > 0)
        {
            //change client username
            for(let u in customUsernames)
            {           
                console.log("user id: " + userId)
                console.log("user socketId: " + customUsernames[u].socketId)
                console.log("username: " + userName)
                console.log("userIp: " + userIp)
                
                if(userId == customUsernames[u].socketId) 
                { 
                    customUsernames[u].username = userName 
                }
                else if(!JSON.stringify(customUsernames).includes(userObj.socketId))
                { 
                    customUsernames.push(userObj)
                }
            }
        }
            
        //debugging
        console.log(customUsernames)
        
        //refresh info on screen
        updateInfo(client)
    })


    //on socket video command message
    client.on('video command', (msgObj) => {
        //variables
        var content = null
        var room = null
        var userId = null
        var userName = null
        var playingVideosLastWholeSecond = null
        var playingVideoId = null
        var videoPlaying = null

        //set variables
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

        if(msgObj.content == "resync2 video")
        {
            for(roomObj in videosCurrentlyPlaying)
            {
                if(videosCurrentlyPlaying[roomObj].room == room)
                {
                    //set obj variables
                    msgObj.playingVideosLastWholeSecond = videosCurrentlyPlaying[roomObj].lastWholeSecond
                    msgObj.videoPlaying = videosCurrentlyPlaying[roomObj].videoPlaying

                    //send socket message
                    SocketServer.sockets.in(msgObj.room).emit('video command', msgObj)
                    
                    //return value
                    break
                }
            }
        }

        else if(msgObj.content == "random playlist")
        {
            //variables
            let category = msgObj.room
            let newPlaylist = randomPlaylist(category)

            //set obj
            msgObj.lastWholeSecond = 0
            msgObj.videoPlaying = false
            msgObj.videoId = null
            msgObj.playlistCurrentVideoIndex = 0 
            msgObj.videoPlaylist = true
            msgObj.videoPlaylistId = newPlaylist

            //send socket message        
            SocketServer.sockets.in(msgObj.room).emit('video command', msgObj)
        }
        
        else if(msgObj.content == "load video")
        {
            //variables
            // room = msgObj.room
            // playingVideoId = msgObj.playingVideoId

            //update obj
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

            //debugging
            // console.log(videosCurrentlyPlaying.length)
            // console.log(JSON.stringify(videosCurrentlyPlaying))

            //send socket message        
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
            let roomName = "\"" + "room" + "\"" + ":" + "\"" + room + "\""
            let newVideosCurrentlyPlaying = []
            
            //debugging
            // console.log("total server rooms: " + serverRooms.length)
            // console.log(serverRooms)
            // console.log(msgObj)
            
            //null check
            if(videosCurrentlyPlaying.length == 0)
            {
                videosCurrentlyPlaying.push(rd)
            }

            //update currently playing videos metadata
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

            //log
            console.log(">>>>>>>>> ROOMS: " + serverRooms.length + " · USERS: " + serverTotalUsers + " <<<<<<<<<")
            
            //print all users
            // for(let u in serverUsersList)
            // {
            //     console.log(serverUsersList[u])
            // }

            //print active rooms
            for(let v in newVideosCurrentlyPlaying)
            {
                //variables
                let obj = newVideosCurrentlyPlaying[v]
                let sm = obj.syncMaster
                let pl = "#"
                let vi = obj.playlistCurrentVideoIndex
                let rn = obj.room
                let vs = obj.lastWholeSecond
                let vp = "#"
                let nr = v;
                let jobj = JSON.stringify(obj)

                if(sm) { sm = sm.toString().substr(0, 4) }
                if(obj.videoPlaylistId) { pl = obj.videoPlaylistId.toString().substring(0, 8) }
                if(obj.videoPlaylist) { vi = obj.videoPlaylist }
                if(rn) { rn = rn }
                if(vs) { vs = vs }
                if(nr) { nr++; }

                //log
                console.log(
                    "· " +
                    "#" +  nr + " · " + 
                    rn + " · " + 
                    "SM:" + sm + " · " + 
                    "VI:" + obj.playlistCurrentVideoIndex + " · " + 
                    "PL:" + vp + " · " +    
                    vs + "s" 
                )
            }

            //update videos currently playing
            videosCurrentlyPlaying = newVideosCurrentlyPlaying

            //log
            console.log("")
            //console.log("videosCurrentlyPlaying: " + videosCurrentlyPlaying.length)
            //console.log("newVideosCurrentlyPlaying: " + newVideosCurrentlyPlaying.length)
                
            //handle client username
            for (let u in customUsernames)
            {
                //set custom username if exists
                if(customUsernames[u].socketId == msgObj.userId) 
                { 
                    msgObj.userName = customUsernames[u].username 
                    break 
                }

            }
    
            //debugging
            // console.log("message content: " +  msgObj.content)
            // console.log("message room: " + msgObj.room)
            // console.log("message userId: " + msgObj.userId)
            // console.log("message userName: " + msgObj.userName)
    
            //send socket message     
            SocketServer.sockets.in(msgObj.room).emit('video command', msgObj)
        }

    })
    

    //refresh info on screen
    updateInfo(client)
    

    //log
    // console.log(allClients)
    // console.log(allRooms)
})
