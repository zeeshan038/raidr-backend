import express from "express";
import ConnectDB from "./config/db.js";
import cors from "cors";
import dotenv from "dotenv"
import Routes from "./routes/index.js";
import "./config/firebase.js";
import swaggerUi from "swagger-ui-express";
import fs from "fs";


dotenv.config();
const app = express();

app.use(cors());

app.use(express.json());

ConnectDB();

// Read the swagger.json file
const swaggerDocument = JSON.parse(fs.readFileSync('./swagger.json', 'utf8'));

// Serve raw JSON for the mobile dev
app.get('/swagger.json', (req, res) => {
  res.json(swaggerDocument);
});

// Serve Swagger UI and display the JSON URL at the top
const swaggerOptions = {
  swaggerOptions: {
    url: '/swagger.json'
  }
};
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(null, swaggerOptions));

app.use("/api",Routes);

app.get("/health",(req,res)=>{
  res.send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Your app is running on PORT ${PORT}`);
});
 