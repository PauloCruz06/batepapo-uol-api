import express from "express";
import { MongoClient, ObjectId } from "mongodb";
import { stripHtml } from "string-strip-html";
import Joi from "joi";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import "dayjs/locale/pt-br.js";

dotenv.config();
dayjs.locale("pt-br");

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

const server = express();
server.use(express.json());
server.use(cors());

mongoClient.connect().then(() => {
    db = mongoClient.db('chatUol');
});

server.post('/participants', (req, res) => {
    const schemaParticipants = Joi.object({
        username: Joi.string().required()
    });
    const name = stripHtml(req.body.name).result.trim();
    const value = schemaParticipants.validate({ username: name });
    if(value.error){
        res.sendStatus(422);
    }else{
        db.collection("participants").findOne({ name: name }).then((doc) => {
            if(doc){
                res.sendStatus(409);
            }else{
                const body = { name: name, lastStatus: Date.now() };
                db.collection("participants").insertOne(body).then(() => {
                    const statusMessage = {
                        from: name,
                        to: 'Todos',
                        text: 'entra na sala...',
                        type: 'status',
                        time: dayjs().format('HH:mm:ss')
                    };
                    db.collection("messages").insertOne(statusMessage).then(() => 
                        res.sendStatus(201)
                    ).catch((e) =>
                        res.status(500).send(e)
                    );
                }).catch((e) =>
                    res.status(500).send(e)
                );
            }
        }).catch((e) =>
            res.status(500).send(e)
        );
    }
});

server.get('/participants', (_,res) => {
    db.collection("participants").find({}).toArray().then((participants) => {
        res.status(200).send(participants);
    }).catch((e) =>
        res.sendStatus(500)
    );
});

server.post('/messages', (req, res) => {
    const body = {
        to: req.body.to,
        text: stripHtml(req.body.text).result.trim(),
        type: req.body.type,
        from: stripHtml(req.headers.user).result.trim() 
    };
    db.collection("participants").find({}).toArray().then((participants) => {
        const participantsList = participants.map(lst => lst.name);
        const schemaMessages = Joi.object({
            to: Joi.string().required(),
            text: Joi.string().required(),
            type: Joi.string().valid('private_message', 'message').required(),
            from: Joi.string().valid(...participantsList).required()
        });
        const value = schemaMessages.validate({
            to: body.to,
            text: body.text,
            type: body.type,
            from: body.from
        });
        if(!value.error){
            const message = { ...body, time: dayjs().format('HH:mm:ss') };
            db.collection("messages").insertOne(message).then(() =>
                res.sendStatus(201)
            ).catch((e) =>
                res.status(500).send(e)
            );
        }else{
            res.sendStatus(422);
        }
    }).catch((e) =>
        res.status(500).send(e)
    );
});

server.get('/messages', (req, res) => {
    const limit = req.query.limit;
    const user = stripHtml(req.headers.user).result.trim();
    db.collection("messages").find({}).toArray().then((messages) => {
        const messageList = messages.filter((message) =>
            (message.from === user || message.to === user || message.to === 'Todos' || message.type === 'message')
        );
        if(limit){
            res.status(200).send(messageList.slice(-limit));
        }else{
            res.status(200).send(messageList);
        }
    }).catch((e) =>
        res.status(500).send(e)
    );
});

server.delete('/messages/:id', (req, res) => {
    const { id } = req.params;
    const user = stripHtml(req.headers.user).result.trim();
    db.collection("messages").findOne({ _id: new ObjectId(id) }).then((async (message) => {
        if(message){
            if(user === message.from){
                try{
                    await db.collection("messages").deleteOne(message);
                }catch (e){
                    res.status(500).send(e);
                }
            }else{
                res.sendStatus(401);
            }
        }else{
            res.sendStatus(404);
        }
    })).catch((e) =>
        res.status(500).send(e)
    );
});

server.put('/messages/:id', (req, res) => {
    const { id } = req.params;
    const body = {
        to: req.body.to,
        text: stripHtml(req.body.text).result.trim(),
        type: req.body.type,
        from: stripHtml(req.headers.user).result.trim() 
    };
    db.collection("participants").find({}).toArray().then(async (participants) => {
        const participantsList = participants.map(lst => lst.name);
        const schemaMessages = Joi.object({
            to: Joi.string().required(),
            text: Joi.string().required(),
            type: Joi.string().valid('private_message', 'message').required(),
            from: Joi.string().valid(...participantsList).required()
        });
        const value = schemaMessages.validate({
            to: body.to,
            text: body.text,
            type: body.type,
            from: body.from
        });
        if(!value.error){
            const newMessage = { ...body, time: dayjs().format('HH:mm:ss') };
            try{
                const message = await db.collection("messages").findOne({ _id: new ObjectId(id) });
                if(message){
                    if(message.from === newMessage.from){
                        await db.collection("messages").updateOne({
                            _id: message._id
                        }, { $set: { ...newMessage } });
                    }else{
                        res.sendStatus(401);
                    }
                }else{
                    res.sendStatus(404);
                }
            }catch(e){
                res.status(500).send(e);
            }
        }else{
            res.sendStatus(422);
        }
    }).catch((e) =>
        res.status(500).send(e)
    );
});

server.post('/status', (req, res) => {
    const user = stripHtml(req.headers.user).result.trim();
    db.collection("participants").findOne({ name: user }).then(async (participant) => {
        if(participant){
            await db.collection("participants").updateOne({
                name: participant.name
            }, { $set: { lastStatus: Date.now() } });
            res.sendStatus(200);
        }else{
            res.sendStatus(404);
        }
    }).catch((e) =>
        res.status(500).send(e)
    );
});

setInterval(async () => {
    const participants = await db.collection("participants").find({}).toArray();
    const deleteParticipants = participants.filter((user) => Date.now()-user.lastStatus > 10000);
    if(deleteParticipants){
        deleteParticipants.map(async (user) => {
            await db.collection("participants").deleteOne(user);
            const statusMessage = {
                from: user.name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: dayjs().format('HH:mm:ss')
            };
            await db.collection("messages").insertOne(statusMessage);
        });
    }
}, 15000);

server.listen(5000);