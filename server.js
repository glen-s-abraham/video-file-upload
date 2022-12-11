const express = require("express");
const path = require("path");
const fs = require("fs");
const { promisify } = require("util");
const { v4: uuidv4 } = require("uuid");
const Busboy = require("busboy");

const app = express();

const getFilePath = (fileName, fileId) =>
  `./uploads/file-${fileId}-${fileName.replace(/\s/g,'-')}`;

const getFileDetails = promisify(fs.stat);

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

app.post("/upload-request", (req, res) => {
  if (!req.body || !req.body.fileName) {
    res.status(400).json({ message: "Missing filename" });
  } else {
    const fileId = uuidv4();
    fs.createWriteStream(getFilePath(req.body.fileName, fileId), {
      flags: "w",
    });
    res.status(200).json({ fileId, fileName: req.body.fileName });
  }
});

app.get("/upload-status", (req, res) => {
    if (!req.query || !req.query.fileName ||!req.query.fileId) {
        return res.status(400).json({
            message: "No file with provided credentials",
            credentials: {
              ...req.params
            },
          });
    } else {
      getFileDetails(getFilePath(req.query.fileName,req.query.fileId))
      .then(stats=>{
        return res.status(200).json({totalChunksUploaded:stats.size})
      })
      .catch(err=>{
        console.log("Failed to read file ", err);
    res.sendStatus(500);
      })
    }
  });

app.post("/upload", (req, res) => {
  const contentRange = req.headers["content-range"];
  const fileId = req.headers["x-file-id"];
  if (!contentRange) {
    return res.status(400).json("Missing Content-Range header");
  }
  if (!fileId) {
    return res.status(400).json("Missing X-File-Id header");
  }

  const match = contentRange.match(/bytes=(\d+)-(\d+)\/(\d+)/);
  if (!match) {
    return res.status(400).json("Invalid Content-Range header");
  }

  const rangeStart = Number(match[1]);
  const rangeEnd = Number(match[2]);
  const fileSize = Number(match[3]);

  if (rangeStart >= fileSize || rangeStart >= rangeEnd || rangeEnd > fileSize) {
    return res.status(400).json("Invalid Content-Range header");
  }

  const busboy = Busboy({ headers: req.headers });
  req.pipe(busboy);

  busboy.on("error", (e) => {
    console.log("Failed to read file ", e);
    res.sendStatus(500);
  });

  busboy.on("finish", () => {
    res.sendStatus(200);
  });

  busboy.on("file", (_, file, fileDat) => {
    const filePath = getFilePath(fileDat.filename, fileId);
    getFileDetails(filePath)
      .then((stats) => {
        if (stats.size !== rangeStart) {
          return res.status(400).json({ message: "Bad chunk Range start" });
        }
        file.pipe(fs.createWriteStream(filePath, { flags: "a" }));
      })
      .catch((err) => {
        console.log(err);
        return res.status(400).json({
          message: "No file with provided credentials",
          credentials: {
            fileId,
            fileName,
          },
        });
      });
  });
});

app.listen(8080, () => {
  console.log("App listening on port 8080");
});
