import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let uolParticipantsdb;
let uolMessagesdb;

const server = express();
server.use(express.json());
server.use(cors());

mongoClient.connect().then(() => {
    uolParticipantsdb = mongoClient.db("uolParticipants");
    uolMessagesdb = mongoClient.db("uolMessages");
});