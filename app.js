require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
app.use(
  cors({
    origin: ["https://resume-maker-7h7e.onrender.com", "http://localhost:3000"],
    credentials: true,
  })
);
app.use(bodyParser.json());
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("Connected to MongoDB");
});
const userSchema = new mongoose.Schema({
  fname: { type: String, required: true },
  lname: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdResumes: [String],
});
const resumeSchema = new mongoose.Schema({
  fname: String,
  lname: String,
  email: String,
  phone: String,
  location: String,
  education: [
    {
      institute: String,
      degree: String,
      grade: String,
      startDate: String,
      endDate: String,
    },
  ],
  projects: [
    {
      title: String,
      stack: String,
      detail: String,
      startDate: String,
      endDate: String,
    },
  ],
  achievements: [{ value: String }],
  courseworks: [{ value: String }],
  userid: String,
  date: { type: Date, default: Date.now },
});
userSchema.pre("save", function (next) {
  const user = this;
  if (!user.isModified("password")) return next();
  bcrypt.hash(user.password, 10, (err, hash) => {
    if (err) return next(err);
    user.password = hash;
    next();
  });
});
const User = mongoose.model("User", userSchema);
const Resume = mongoose.model("Resume", resumeSchema);
app.use(cookieParser());
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: true,
  })
);
app.post("/create", (request, response) => {
  const resume = new Resume(request.body);
  resume
    .save()
    .then((resume) => {
      User.findByIdAndUpdate(
        { _id: resume.userid },
        { $push: { createdResumes: resume._id } },
        { new: true }
      )
        .then(() => {
          console.log("here");
        })
        .catch((err) => {
          return res.status(500).send({ error: "Error updating the user" });
        });
      console.log("here2");
      response.send({ message: "Input saved successfully" });
    })
    .catch((error) => {
      console.log("here3");
      response.status(400).send({ error: "Error in creating course" });
    });
});

app.get("/resume/:id", (req, res) => {
  let id = req.params.id;
  Resume.findOne({ _id: id })
    .then((result) => {
      res.json(result);
    })
    .catch((err) => {
      console.log(err);
    });
});
app.get("/myresumes/:userId", (req, res) => {
  const userId = req.params.userId;
  User.findById(userId)
    .then((user) => {
      if (!user) {
        return res.status(404).send("User not found");
      }
      const resumeIds = user.createdResumes;
      Resume.find({
        _id: { $in: resumeIds },
      })
        .then((resumes) => {
          res.send(resumes);
        })
        .catch((err) => {
          res.status(500).send(err.message);
        });
    })
    .catch((err) => {
      res.status(500).send(err.message);
    });
});

app.delete("/resumes/:id", function (req, res) {
  Resume.findByIdAndDelete(req.params.id)
    .then((resume) => {
      if (!resume) {
        return res.status(404).send({ error: "Card not found" });
      }
      res.send(resume);
    })
    .catch((err) => {
      return res.status(500).send({ error: "Error deleting resume" });
    });
});
app.post("/register", (req, res) => {
  const { fname, lname, email, password } = req.body;
  const user = new User({ fname, lname, email, password });
  user
    .save()
    .then((user) => {
      req.session.user = user;
      res.cookie("user", user, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
      res.json({ msg: "User created successfully", isLoggedIn: true, user });
    })
    .catch((err) => {
      return res.status(400).json({ msg: "Email already exists" });
    });
});
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  User.findOne({ email }).then((user) => {
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    bcrypt.compare(password, user.password).then((isMatch) => {
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid credentials" });
      }
      req.session.user = user;
      res.cookie("user", user, {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
      res.json({ isLoggedIn: true, user });
    });
  });
});

app.post("/logout", (req, res) => {
  res.clearCookie("user");
  req.session.destroy(() => {
    res.send({ success: true });
  });
});
app.get("/check-login", (req, res) => {
  const user = req.cookies.user;
  if (!user) {
    return res.json({ isLoggedIn: false });
  }
  res.json({ isLoggedIn: true, user });
});
app.get("*", (req, res) => {
  res.status(404).send("Page not found");
});

app.listen(process.env.PORT || 5000, () =>
  console.log("Listening on port 5000")
);
