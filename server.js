const express = require("express")
const PORT = 3001
const app = express()

app.use(express.static('docs'))

app.use(express.urlencoded({ extended: false }));
app.get("/", (req, res) => {
    
})

app.listen(PORT, () => {
    console.log(`Listening at http://localhost:${PORT}`)
});