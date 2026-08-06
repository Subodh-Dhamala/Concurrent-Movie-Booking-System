import "reflect-metadata";
import express from "express";
import dotenv from "dotenv";
import { AppDataSource } from "./lib/database";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT ?? 5000);

app.use(express.json());

app.get('/',(req,res)=>{
    res.send("WORKING....");
})


async function startServer(){
    try{
        await AppDataSource.initialize();
        console.log("DB CONNECTED!");
        app.listen(PORT,()=>{
        console.log(`Server is listening at http://localhost:${PORT}`);
    })
    }
    catch(error){
        console.error("DB conncection failed", error);
        process.exit(1);
    }
    
}

startServer();

export default app;