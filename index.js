/****** INCLUDES ******/
const express = require('express')
const app = express()
const http = require('http')
const server = http.createServer(app)
const { Server } = require("socket.io")
const playlistsJSON = require('./playlists.json')
// const { time } = require('console')
// const cors = require('cors')


/****** VARIABLES ******/
const defaultRooms = []
var customUsernames = []
var serverRooms = []
var serverUsersList = []
var videosCurrentlyPlaying = []
var serverAdmins = []
var serverDefaultPlaylists = []
var serverTotalUsers = null
let port = process.env.PORT || 3000
var nsps = null
var all_namespaces = null
var SocketServer = null


/****** START SERVER ******/
server.listen(port, () => { console.log('listening on *:' + port) })

SocketServer = new Server(server, //set socket server
{ 
    //cors settings 
    cors: { handlePreflightRequest: (req, res) => { res.writeHead(200, { 
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Methods": "GET", 
            // "Access-Control-Allow-Headers": "*",
            // "Access-Control-Allow-Credentials": true
        }), res.end() 
}}})

for(let c in playlistsJSON) //add default rooms to array
{ defaultRooms.push(playlistsJSON[c].category) } 

nsps = SocketServer._nsps //set namespaces
all_namespaces = Array.from(nsps, ([namespace]) => ({ type: 'namespace', namespace})) //set all namspaces obj


/****** HANDLE SOCKET TRAFFIC ******/
SocketServer.of("/").on('connection', (client) => {
    //variables
    var socketId = client.id
    var clientIp = client.client.conn.remoteAddress
    var clientNsp = client.nsp.name
    var totalClients = client.server.httpServer._connections
    let clientId = client.id
    let clientName = "anon" + client.id.substring(0, 4).toUpperCase()

    //join temp room
    client.join("temp") 


    //ON CHAT MESSAGE
    client.on('chat message', (msgObj) => { SocketServer.sockets.in(msgObj.room).emit('chat message', msgObj) })


    //ON JOIN ROOM
    client.on('join room', (msg) => {
        //variables
        let newRoom = msg[0]
        let oldRoom = msg[1]

        //leave old socket room and join new socket room
        client.leave(oldRoom)
        client.join(newRoom)

        //update info on screen
        updateInfoOnScreen(client)

        //create socket messages
        let msgLeftRoom = {content: " left the room", room: newRoom, userId: client.id, userName: clientName }
        let msgJoinRoom = {content: " joined the room", room: newRoom, userId: client.id, userName: clientName }
        
        //send socket messages
        SocketServer.sockets.in(oldRoom).emit('leave room', msgLeftRoom)
        SocketServer.sockets.in(newRoom).emit('join room', msgJoinRoom)
    })


    //ON CREATE ROOM
    client.on('create room', (msg) => {
        //variables
        let newRoom = msg[0]
        let oldRoom = msg[1]
        
        //check for forbidden characters
        newRoom = newRoom.replace(",", "")
        
        //leave old room 
        client.leave(oldRoom)

        //join new room
        client.join(newRoom)
        
        //update info on screen
        updateInfoOnScreen(client)
        
        //create msgs
        let msgLeftRoom = {content: " left the room", room: newRoom, userId: client.id, userName: clientName }
        let msgCreateRoom = {content: " created room " + newRoom, room: newRoom, userId: client.id, userName: clientName }
        
        //send socket messages
        SocketServer.sockets.in(oldRoom).emit('leave room', msgLeftRoom)
        SocketServer.sockets.in(newRoom).emit('create room', msgCreateRoom)
    })
    

    //ON DISCONNECT
    client.on('disconnect', () => {
        //variables
        let clientRooms = Array.from(client.adapter.rooms, ([room]) => ({room}))
        let disconnectRoom = ""
        let clientId = client.id
        
        //update server users list
        for(let c in serverUsersList)
        {
            if(serverUsersList[c][0] == clientId) 
            {
                disconnectRoom = serverUsersList[c][1] //room user left
                serverUsersList.splice(c, 1) //update array
            }
        }

        //create msgs
        let msgLeftRoom = {content: " left the room", room: disconnectRoom, userId: client.id, userName: clientName }
        
        //send socket message
        SocketServer.sockets.in(disconnectRoom).emit('leave room', msgLeftRoom)

        //update info on screen
        updateInfoOnScreen(client)
    })


    //ON VIDEO COMMAND
    client.on('video command', (msgObj) => {
        //variables
        var content = msgObj.content
        var room = msgObj.room
        var userId = msgObj.userId
        var userName = msgObj.userName
        var playingVideosLastWholeSecond = msgObj.playingVideosLastWholeSecond
        var playingVideoId = msgObj.playingVideoId
        var videoPlaying = msgObj.videoPlaying
        var playlistCurrentVideoIndex = msgObj.playlistCurrentVideoIndex
        var videoPlaylist = msgObj.videoPlaylist
        var videoPlaylistId = msgObj.videoPlaylistId
        var syncMaster = msgObj.syncMaster
        

        //RESYNC 2
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


        //RANDOM PLAYLIST
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
        

        //LOAD VIDEO
        else if(msgObj.content == "load video")
        {
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

            //send socket message        
            SocketServer.sockets.in(msgObj.room).emit('video command', msgObj)
        }
        

        //OTHERS
        else if(msgObj.content != "load video")
        {
            //variables
            let roomName = "\"" + "room" + "\"" + ":" + "\"" + room + "\""
            let newVideosCurrentlyPlaying = []
            let rd = JSON.parse("{" 
                                + "\"room\"" + ":" + "\"" + room + "\"" + "," + "\"videoId\"" + ":" + "\"" + playingVideoId + "\"" + "," + 
                                "\"lastWholeSecond\"" + ":" + playingVideosLastWholeSecond + "," + "\"id\"" + ":" + "\"" + room + 
                                playingVideoId + "\"" + "," + "\"videoPlaying\"" + ":" + "\"" + videoPlaying + "\"" + "," + "\"syncMaster\"" + 
                                ":" + "\"" + syncMaster + "\"" + 
                            "}")
            

            
            //null check
            if(videosCurrentlyPlaying.length == 0) { videosCurrentlyPlaying.push(rd) }

            //update metadata (currently playing videos)
            else if(videosCurrentlyPlaying.length > 0)
            {
                //update old room data
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

                //add new room
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

            //update videos currently playing
            videosCurrentlyPlaying = newVideosCurrentlyPlaying

            //send socket message     
            SocketServer.sockets.in(msgObj.room).emit('video command', msgObj)

            //log
            devLog(serverRooms, serverTotalUsers, newVideosCurrentlyPlaying)
        }

    })
    

    //update info on screen
    updateInfoOnScreen(client, clientNsp, clientIp, socketId)
})


/****** FUNCTIONS ******/
function updateInfoOnScreen(client, clientNsp, clientIp, socketId)
{
    //variables
    let rooms = client.adapter.rooms
    let clients = client.adapter.sids
    let clientsAll = Array.from(clients)
    let allClients = Array.from(clients, ([client]) => ({ type: 'client', client }))
    let allRooms = Array.from(rooms, ([room, clients]) => ({type: 'room', room, clients: Array.from(clients) }))
    let allRoomsFormatted = []
    let clientsAllJSON = []
    //let yourRooms = Array.from(client.rooms)
    //let clientNames = customUsernames
    
    //set total users arrays
    serverTotalUsers = clientsAll.length

    //add client to server users list
    for(let u in clientsAll) 
    {
        let user = Array.from(clientsAll[u][1])
        let userId = user[0]
        let userRoom = user[1] 
        
        //add user to array
        if(!serverUsersList.toString().includes(userId)) { serverUsersList.push(user) }
       
        //update user room
        else 
        { 
            for(let c in serverUsersList) 
            { if(serverUsersList[c][0] == userId) { serverUsersList[c][1] = userRoom; break } } 
        }
    }
    
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

        //set client room
        clientRoom = clientStringifiedSplit[1]
        if(clientRoom == null) { clientRoom = "" }

        //set client obj
        clientJSON = "{" + 
                        "\"type\"" + ":" + "\"client\"" + "," + "\"namespace\"" + ":" + "\"" + clientNsp + "\"" + "," + "\"id\"" + ":" + 
                        "\"" + clientId + "\"" + "," + "\"room\"" + ":" + "\"" + clientRoom + "\"" + "," + 
                        "\"name\""+ ":" + "\"" + clientName + "\"" + 
                        "}"

        clientJSON = JSON.parse(clientJSON)
        
        //update client list
        clientsAllJSON.push(clientJSON)
    }

    //remove personal rooms
    for(r in allRooms)
    {
        if(allRooms[r].room != allRooms[r].clients) { allRoomsFormatted.push(allRooms[r]) }
    }
    
    //send socket message
    SocketServer.emit('info', allRoomsFormatted, allClients, all_namespaces, clientsAllJSON, videosCurrentlyPlaying, JSON.stringify(playlistsJSON), defaultRooms)

    //update server rooms
    serverRooms = allRoomsFormatted
}


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


function devLog(serverRooms, serverTotalUsers, newVideosCurrentlyPlaying)
{
    //header
    console.log("")
    console.log("")
    console.log("")
    console.log(">>>>>>>>> ROOMS: " + serverRooms.length + " · USERS: " + serverTotalUsers + " <<<<<<<<<")
        
    //users
    // for(let u in serverUsersList) 
    // {
    //     console.log(serverUsersList[u])
    // }
    
    //rooms
    for(let v in newVideosCurrentlyPlaying) 
    {
        //variables
        let obj = newVideosCurrentlyPlaying[v]
        let sm = obj.syncMaster
        let pl = "#"
        let vi = "#"
        let rn = obj.room
        let vs = obj.lastWholeSecond
        let vp = "#"
        let nr = v;
        let jobj = JSON.stringify(obj)

        if(sm) { sm = sm.toString().substr(0, 4) }
        if(obj.videoPlaylist) { pl = obj.videoPlaylist }
        if(obj.playlistCurrentVideoIndex) { vi = obj.playlistCurrentVideoIndex; vi++ }
        if(rn) { rn = rn }
        if(vs) { vs = vs }
        if(nr) { nr++; }

        console.log(
            "· " +
            "#" +  nr + " · " + 
            rn + " · " + 
            "SM:" + sm + " · " + 
            "VI:" + vi + " · " + 
            "PL:" + pl + " · " +    
            vs + "s"
        )
    }
}
