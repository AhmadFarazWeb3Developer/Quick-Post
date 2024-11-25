const multer = require('multer')
const path = require('path')
const crypto = require('crypto')

// diskStorage is used for uploading files to server side , like in the folder of the code

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/images/uploads')
    },
    filename: (req, file, cb) => {
        crypto.randomBytes(12, (err, randomName) => {
            const fn = randomName.toString('hex') + path.extname(file.originalname);
            cb(null, fn)
        })
    }
})

const upload = multer({ storage, })

module.exports = upload