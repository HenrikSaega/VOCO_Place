const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { engine } = require("express-handlebars");

const sequelize = require("./config/database");
const pageController = require("./controllers/pageController");
const setupSockets = require("./controllers/socketController");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.engine("hbs", engine({ extname: ".hbs" }));
app.set("view engine", "hbs");
app.set("views", "./views");

app.use(express.static("public"));

app.get("/", pageController.renderHomePage);

const PORT = 3000;

sequelize
  .sync({ force: false })
  .then(() => {
    console.log("✅ Andmebaas (SQLite) on ühendatud ja sünkroniseeritud!");

    setupSockets(io);

    server.listen(PORT, () => {
      console.log(`🚀 Server lendab aadressil http://localhost:${PORT}`);
    });
  })
  .catch((viga) => {
    console.error("❌ Viga andmebaasiga ühendamisel:", viga);
  });
