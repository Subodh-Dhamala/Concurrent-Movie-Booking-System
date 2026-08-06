import {DataSource} from 'typeorm';
import dotenv from "dotenv";

dotenv.config();

const isProd = process.env.NODE_ENV == 'production';

export const AppDataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST,
    port : Number(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,

    entities : [__dirname + `/../entities/*{isProd ? "js": "ts"}`],
    migrations : [__dirname + `/../migrations/*.${isProd ? "js" : "ts"}`],

    synchronize : false,
    logging: false,
    
})