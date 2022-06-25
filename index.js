import express from "express";
import { MongoClient } from "mongodb";
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
    const value = schemaParticipants.validate({ username: req.body.name });
    if(value.error){
        res.sendStatus(422);
    }else{
        db.collection("participants").findOne({ name: req.body.name }).then((doc) => {
            if(doc){
                res.sendStatus(409);
            }else{
                const body = { ...req.body, lastStatus: Date.now() };
                db.collection("participants").insertOne(body).then(() => {
                    const message = {
                        from: body.name,
                        to: 'Todos',
                        text: 'entra na sala...',
                        type: 'status',
                        time: dayjs().format('HH:mm:ss')
                    };
                    db.collection("messages").insertOne(message).then(() => 
                        res.sendStatus(201)
                    ).catch((e) =>
                        res.sendStatus(500)
                    );
                }).catch((e) =>
                    res.sendStatus(500)
                );
            }
        }).catch((e) =>
            res.sendStatus(500)
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
    db.collection("participants").find({}).toArray().then((participants) => {
        const participantsList = participants.map(lst => lst.name);
        const schemaMessages = Joi.object({
            to: Joi.string().required(),
            text: Joi.string().required(),
            type: Joi.string().valid('private_message', 'message').required(),
            from: Joi.string().valid(...participantsList).required()
        });
        const value = schemaMessages.validate({
            to: req.body.to,
            text: req.body.text,
            type: req.body.type,
            from: req.headers.user
        });
        if(!value.error){
            const message = { from: req.headers.user,...req.body, time: dayjs().format('HH:mm:ss') };
            db.collection("messages").insertOne(message).then(() =>
                res.sendStatus(201)
            ).catch((e) =>
                res.sendStatus(500)
            );
        }else{
            console.log(value.error);
            res.sendStatus(422);
        }
    }).catch((e) =>
        res.sendStatus(500)
    );
});

server.get('/messages', (req, res) => {
    const limit = req.query.limit;
    const user = req.headers.user;
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
        res.sendStatus(500)
    );
});

server.post('/status', (req, res) => {
    const user = req.headers.user;
    db.collection("participants").findOne({ name: user }).then((participant) => {
        if(participant){
            db.collection("participants").updateOne({
                name: participant.name
            }, { $set: { lastStatus: Date.now() } });
            res.sendStatus(200);
        }else{
            res.sendStatus(404);
        }
    }).catch((e) =>
        res.sendStatus(500)
    );
});

server.listen(5000);