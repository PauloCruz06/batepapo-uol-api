import express from "express";
import { MongoClient } from "mongodb";
import { schemaParticipants } from "./src/validations.js";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import "dayjs/locale/pt-br.js";

dotenv.config();
dayjs.locale("pt-br");

const mongoClient = new MongoClient("mongodb://127.0.0.1:27017");
let db;

const server = express();
server.use(express.json());
server.use(cors());

mongoClient.connect().then(() => {
    db = mongoClient.db('chatUol');
});

server.post('/participants', (req, res) => {
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

server.listen(5000, () => { console.log("Rodando em http://localhost:5000"); });