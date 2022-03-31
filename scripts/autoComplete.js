function autocomplete(text) {
    const q = "https://en.wikipedia.org/w/api.php?action=opensearch&limit=10&format=json&&origin=*search=a" + text
    
    return fetch(q).then(res => res.json()).then(data => {
        console.log(data)
    })
}