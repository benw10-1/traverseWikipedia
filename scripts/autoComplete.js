function autocomplete(text) {
    const q = `https://en.wikipedia.org/w/api.php?action=opensearch&limit=10&format=json&search=${text}&origin=*`
    
    return fetch(q).then(res => res.json())
}