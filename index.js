import express from "express";
import ConnectDB from "./config/db.js";
import cors from "cors";
import dotenv from "dotenv"
import Routes from "./routes/index.js";
import "./config/firebase.js";
dotenv.config();
const app = express();

app.use(cors());

app.use(express.json());

ConnectDB();

app.use("/api",Routes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Your app is running on PORT ${PORT}`);
});
