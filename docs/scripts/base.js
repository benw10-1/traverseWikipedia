var search, autocomp, loading, Graph, graphEl

const titleRegex = /[:]|(Category)/
const colorScheme = ["#E63946", "#1D3557", "#A8DADC", "#F1FAEE"]
const keysExp = /(Backspace)|(Escape)|(Control)|\s/
const delay = (ms) => {
    return new Promise((res) => {
        setTimeout(res, ms)
    })
}

function loadEls() {
    search = document.getElementById("search")
    autocomp = document.getElementById("autocomplete")
    graphEl = document.getElementById("graph")
    loadVisual()

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
            search.blur()
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
    }).catch((err) => err)
}

function pageRoot(page, opt) {
    if (loading) return new Promise((res) => res())
    loading = true
    // default opt
    opt = {
        maxDepth: 2,
        maxNodes: 1100,
        maxInitial: 1000,
        childMax: 10,
        directed: true
    }
    return new Promise(async (res) => {
        let autocomp = await autocomplete(page)
        if (!autocomp || !autocomp[1] || autocomp[1].length < 1) return 
        let data = await processPageWiki(page)
        if (!data || !data.title || !data.links || data.links.length === 0) {
            loading = false
            res() //await getDefault()
            return
        }
        if (data.links.length === 1) {
            data = await processPageWiki(data.links[0])
        }
        
        var toProcess = data.links.slice(0, opt.maxInitial)
        var nodes = [{
            id: data.title,
            group: 0,
            color: colorScheme[0],
            nH: [],
            lH: [],
        }], links = []
        var promises = 0
        let visited = {}
        visited[data.title] = {
            nodes: [],
            links: []
        }

        while ((toProcess.length > 0) || promises > 0) {
            if (toProcess.length === 0 || promises > 100) {
                await delay(200)
                continue
            }
            let [item, depth, root] = toProcess.pop()
            let link = {
                source: root,
                target: item,
                value: depth
            }, node = {
                id: item,
                group: depth,
                color: colorScheme[depth % colorScheme.length],
                mp: data.title
            }
            let found = visited[item]
            if (!found) {
                nodes.push(node)
                links.push(link)
                visited[item] = {}
                if (visited[root]) {
                    visited[item].nodes = [node, ...visited[root].nodes]
                    visited[item].links = [link, ...visited[root].links]
                    node.lH = visited[item].links
                    node.nH = visited[item].nodes
                }
            }
            else if (!opt.directed) {
                links.push(link)
            }
            if (depth < opt.maxDepth) {
                promises += 1
                processPageWiki(item, depth, opt.childMax).then(innerDat => {
                    if (innerDat && innerDat.links) toProcess.push(...innerDat.links)
                    promises -= 1
                })
            }
        }
        let result = {
            links: links,
            nodes: nodes
        }
        
        loading = false
        if (opt.directed){ 
            Graph.linkDirectionalArrowLength(6)
        }

        res(result)
    })
}

function drawData(obj) {
    if (typeof obj === "string") obj = JSON.parse(obj)
    const NODE_R = 8
    const hL = new Set()
    const hN = new Set()
    let first = true
    Graph.graphData(obj)
    .nodeRelSize(NODE_R)
    .onNodeHover(node => {
        hN.clear()
        hL.clear()
        graphEl.style.cursor = ""
        if (node) {
            graphEl.style.cursor = "pointer"
            hN.add(node)
            node.nH.forEach(n => hN.add(n))
            node.lH.forEach(l => hL.add(l))
        }

        hoverNode = node || null
    })
    .autoPauseRedraw(false) // keep redrawing after engine has stopped
    .linkWidth(link => hL.has(link) ? 6 : 1)
    .linkDirectionalParticles(4)
    .linkDirectionalParticleWidth(link => hL.has(link) ? 4 : 0)
    .nodeCanvasObjectMode(node => hN.has(node) ? 'before' : undefined)
    .nodeCanvasObject((node, ctx) => {
        ctx.beginPath()
        ctx.arc(node.x, node.y, NODE_R * 1.4, 0, 2 * Math.PI, false)
        ctx.fillStyle = node === hoverNode ? 'red' : 'orange'
        ctx.fill()
    })
    .cooldownTicks(100)
    Graph.onEngineStop(() => {
        if (first) {
            first = false 
            Graph.zoomToFit(500)
        }
    })
}
// https://en.wikipedia.org/wiki/
function loadVisual() {
    Graph = ForceGraph()(document.getElementById('graph'))
    .nodeId('id')
    .nodeVal('val')
    .nodeLabel(node => {
        let cont = document.createElement("div")
        let pt = [node.mp, ...node.nH.map(e => e.id).reverse()].join(" 🡒 ")
        let h1 = document.createElement("h1")
        h1.innerHTML = node.id
        h1.style.fontSize = "larger"
        h1.style.fontWeight = "bolder"
        // h1.style.color = "#E63946"
        cont.appendChild(h1)
        if (pt) {
            let sp = document.createElement("span")
            sp.style.display = "block"
            // sp.style.fontWeight = "bolder"
            sp.innerHTML = pt
            cont.appendChild(sp)
        }

        // cont.innerHTML += "<span style='font-weight:lighter;'>Click on the node to visit the page!</span>"
        
        return cont.innerHTML
    })
    .linkSource('source')
    .linkTarget('target')

    window.addEventListener("resize", (event) => {
        Graph.height(window.innerHeight)
        Graph.width(window.innerWidth)
    })
}