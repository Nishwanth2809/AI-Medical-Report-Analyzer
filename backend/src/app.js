const express = require("express");
const cors = require("cors");
const path = require("path");

require("dotenv").config({ quiet: true });

const uploadRouter = require("./routes/upload");

const app = express();

app.use(cors());
app.use(express.json());

// ✅ serve frontend (optional)
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => res.send("Medical Report AI Node Backend Running"));

// ✅ main route
app.use("/upload", uploadRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://127.0.0.1:${PORT}`));
