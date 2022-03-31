var search, autocomp, loading, Graph

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
    autocomp = document.getElementById("autocomplete")

    loadVisual()

    document.getElementsByClassName(".gh")[0].addEventListener("click", event => {
        window.open("https://github.com/benw10-1/traverseWikipedia")
    })

    search.addEventListener("input", event => {
        if (!search.value) {
            autocomp.innerHTML = ""
            return
        }
        autocomplete(search.value).then(data => {
            autocomp.innerHTML = ""
            for (let i=0; (i < data[1].length) && (i < 5); i++) {
                let entry = document.createElement("div")
                entry.className = "entry"
                entry.innerHTML = data[1][i]

                entry.addEventListener("click", (event) => {
                    search.value = event.target.innerHTML
                    autocomp.innerHTML = ""
                    pageRoot(search.value).then(data => {
                        drawData(data)
                    })
                })

                autocomp.appendChild(entry)
            }
        })
    })
    search.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            autocomp.innerHTML = ""
            pageRoot(search.value.trim()).then(data => {
                if (!data) return
                drawData(data)
            })
        }
    })
    window.addEventListener("click", event => {
        if (event.target.className !== "entry" && event.target.tagName !== "INPUT") {
            autocomp.innerHTML = ""
        }
    })
}

function processPageWiki(page, depth=0, maxLinks=500) {
    const link = "https://en.wikipedia.org/w/api.php?" + new URLSearchParams({
        origin: "*",
        action: "query",
        titles: page,
        format: "json",
        prop: "links",
        pllimit: maxLinks,
    })
    return fetch(link).then(data => data.json()).then(data => {
        const pages = data.query.pages
        if (pages["-1"]) return {
            links: [],
            title: page
        }
        let sl = pages[Object.keys(data.query.pages)[0]]
        sl.links = sl.links.filter(e => !e.title.match(titleRegex)).map(e => {
            return [e.title, depth + 1, sl.title]
        })
        return sl
    }).catch((err) => console.log(err))
}

function pageRoot(page, opt) {
    if (loading) return new Promise((res) => res())
    loading = true
    // default opt
    opt = {
        maxDepth: 2,
        maxNodes: 500,
        childMax: 10,
    }
    return new Promise(async (res) => {
        let autocomp = await autocomplete(page)
        if (!autocomp || !autocomp[1] || autocomp[1].length < 1) return 
        let data = await processPageWiki(page)
        if (!data || !data.title || !data.links || data.links.length === 0) {
            res() //await getDefault()
            return
        }
        var toProcess = data.links
        var nodes = [{
            id: data.title,
            group: 0,
            color: colorScheme[0]
        }], links = []
        var promises = 0
        let visited = new Set()
        visited.add(data.title)

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
            links.push({
                source: root,
                target: item,
                value: depth
            })
            
            visited.add(item)
            
            if (depth < opt.maxDepth) {
                promises += 1
                processPageWiki(item, depth, opt.childMax).then(innerDat => {
                    toProcess.push(...innerDat.links)
                    promises -= 1
                })
            }
        }
        let result = {
            links: links,
            nodes: nodes
        }
        
        loading = false
        // console.log(nodes)
        res(result)
    })
}

function drawData(obj) {
    if (typeof obj === "string") obj = JSON.parse(obj)
    Graph.graphData(obj)
}

function loadVisual() {
    Graph = ForceGraph()(document.getElementById('graph'))
    .nodeId('id')
    .nodeVal('val')
    .nodeLabel('id')
    .linkSource('source')
    .linkTarget('target')
}