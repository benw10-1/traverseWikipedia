const titleRegex = /[:]|(Category)/
const colorScheme = ["#E63946", "#1D3557", "#A8DADC"]
const keysExp = /(Backspace)|(Escape)|(Control)|\s/
const delay = (ms) => {
    return new Promise((res) => {
        setTimeout(res, ms)
    })
}

function loadEls() {
    search = document.getElementById("search")

    search.addEventListener("keypress", event => {
        autocomplete(search.value + (event.key.match(keysExp) ? "" :event.key))
    })
}

function processPageWiki(page, depth=0) {
    const link = "https://en.wikipedia.org/w/api.php?" + new URLSearchParams({
        origin: "*",
        action: "parse",
        page: page,
        format: "json",
        prop: "text|links",
        // redirects: true
    })
    return fetch(link).then(data => data.json()).then(data => {
        if (!data || !data.parse || !data.parse.links || !data.parse.title) {
            data.parse = {
                links: [],
                title: page
            }
        }
        console.log(data.parse.iwlinks, data.parse.links)
        data.parse.links = data.parse.links.filter(e => !e["*"].match(titleRegex)).map(e => {
            return [e["*"], depth + 1, data.parse.title]
        })
        return data.parse
    }).catch((err) => console.log(err))
}

function pageRoot(page, opt) {
    // default opt
    opt = {
        maxDepth: 2,
        maxNodes: 20000,
        childMax: 10,
    }
    let visited = new Set()
    let urls = new Set()

    return new Promise(async (res) => {
        let data = await processPageWiki(page)
        if (!data || !data.title || !data.links || data.links.length === 0) return {
            nodes: [],
            links: []
        }
        var toProcess = data.links
        await delay(50)
        // console.log(...toProcess)
        var nodes = [{
            id: data.title,
            group: 0,
            color: colorScheme[0]
        }], links = []
        var promises = 0
        while ((toProcess.length > 0) || promises > 0) {
            if (toProcess.length === 0) {
                await delay(200)
                continue
            }
            let [item, depth, root] = toProcess.pop()
            if (!visited.has(item)) {
                nodes.push({
                    id: item,
                    group: depth,
                    color: colorScheme[depth % colorScheme.length]
                })
            }
            visited.add(item)
            links.push({
                source: root,
                target: item,
                value: depth
            })
            
            if (depth < opt.maxDepth) {
                promises += 1
                console.log(item, depth)
                processPageWiki(item, depth).then(innerDat => {
                    innerDat.links = innerDat.links.slice(0, opt.childMax)
                    toProcess.push(...innerDat.links)
                }).then(_ => {
                    promises -= 1
                })
            }
        }
        let result = {
            nodes: nodes,
            links: links
        }
        res(result)
    })
}

function loadVisual(obj) {
    if (typeof obj === "string") obj = JSON.parse(obj)

    const Graph = ForceGraph()
    (document.getElementById('graph'))
    .graphData(obj)
    .nodeId('id')
    .nodeVal('val')
    .nodeLabel('id')
    .linkSource('source')
    .linkTarget('target')
}