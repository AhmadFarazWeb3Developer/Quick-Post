require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const userModel = require("./models/user");
const postModel = require('./models/post')
const path = require('path')
const upload = require('./config/multerConfig')

const app = express();
const jwtSecret = process.env.JWT_SECRET || "MySecretKey";

app.set("view engine", "ejs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')))


app.get("/profile", isloggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email }).populate('posts');
        if (!user) {
            return res.status(404).render("login", { message: "User not found" });
        }

        res.render("profile", { user });
    } catch (error) {
        console.error("Error fetching user:", error);
        return res.status(500).render("error", { message: "Failed to load user profile" });
    }
});

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", async (req, res) => {
    const { username, name, age, email, password } = req.body;

    try {
        const user = await userModel.findOne({ email });
        if (user) {
            return res.status(409).send("Email already exists");
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const newUser = await userModel.create({
            username,
            name,
            age,
            email,
            password: hashedPassword,
        });

        if (newUser) {
            const token = jwt.sign(
                { email: newUser.email, userId: newUser._id },
                jwtSecret
            );
            res.cookie("token", token, { httpOnly: true });
            res.redirect('/profile')
        } else {
            return res.status(500).send("Error registering user");
        }
    } catch (err) {
        console.error("Error during registration:", err);
        return res.status(500).send("Server error during registration");
    }
});

app.get("/login", (req, res) => {
    res.render("login", { message: null });
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await userModel.findOne({ email });

        if (!user) {
            return res.status(404).render("login", { message: "User not found" });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (isPasswordMatch) {
            const token = jwt.sign(
                { email: user.email, userId: user._id },
                jwtSecret
            );
            res.cookie("token", token, { httpOnly: true });

            return res
                .status(200)
                .redirect("/profile");
        } else {
            return res
                .status(401)
                .render("login", { message: "Incorrect password" });
        }
    } catch (error) {
        console.error("Error during login:", error);
        return res.status(500).send("An error occurred during login");
    }
});

app.get("/logout", (req, res) => {
    res.render("logout", { message: null });
});

app.post("/logout", (req, res) => {
    res.clearCookie("token", { httpOnly: true });
    res.redirect("/login");
});

function isloggedIn(req, res, next) {
    if (!req.cookies.token) {
        return res.render('login');
    }
    try {
        const data = jwt.verify(req.cookies.token, jwtSecret);
        req.user = data;
        next();
    } catch (err) {
        console.error("Invalid or expired token:", err);
        return res.render('login', { message: "Session expired. Please login again." });
    }
}

app.post('/post', isloggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email })
    const { content } = req.body
    const post = await postModel.create({
        user: user._id,
        content,
    })

    user.posts.push(post._id)
    await user.save()
    res.redirect('/profile')
})


app.get('/like/:id', isloggedIn, async (req, res) => {
    const post = await postModel.findOne({ _id: req.params.id }).populate('user');
    /* EXAMPLE
         {
            "_id": "603d9f9b5b3e1b25b8d19d85",
                "content": "This is my first post!",
                    "user": {
                "_id": "603d9f5b5b3e1b25b8d19d84",
                    "username": "john_doe",
                        "name": "John Doe",
                            "age": 28,
                                "email": "john.doe@example.com"
            },
            "likes": [
                {
                    "_id": "603d9f5b5b3e1b25b8d19d85",
                    "username": "jane_doe",
                    "name": "Jane Doe",
                    "age": 25,
                    "email": "jane.doe@example.com"
                },
                {
                    "_id": "603d9f5b5b3e1b25b8d19d87",
                    "username": "alice_smith",
                    "name": "Alice Smith",
                    "age": 30,
                    "email": "alice.smith@example.com"
                }
            ]
        }
    
    */


    if (post.likes.indexOf(req.user.userId) === -1) {
        post.likes.push(req.user.userId)
    }
    else {
        post.likes.splice(post.likes.indexOf(req.user.userId), 1) // Removes 1 element at index the found index means user id 
    }

    await post.save()
    res.redirect('/profile')
})


app.get('/edit/:id', isloggedIn, async (req, res) => {
    const post = await postModel.findOne({ _id: req.params.id }).populate('user')
    res.render('edit', { post })
})

app.post('/update/:id', isloggedIn, async (req, res) => {
    await postModel.findOneAndUpdate({ _id: req.params.id }, { content: req.body.content })
    res.redirect('/profile')

})



app.get('/upload/profile', (req, res) => {
    res.render('uploadProfile')
})

app.post('/change/profile', isloggedIn, upload.single('image'), async (req, res) => {

    const user = await userModel.findOne({ email: req.user.email });
    user.profilePic = req.file.filename;
    await user.save()
    res.redirect('/profile')

})



app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
});