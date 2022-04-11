// declare global variables
var search, autocomp, loading, Graph, graphEl, logger, logtm, isnt
// regex for skipping over titles, color scheme for points, and input key ignores respectively
const titleRegex = /[:]|(Category)|(\.[a-z]+)/
const redRegex = /(,[0-9],)+/
const colorScheme = ["#E63946", "#1D3557", "#A8DADC", "#F1FAEE"]
const keysExp = /(Backspace)|(Escape)|(Control)|\s/
// async delay function to bottleneck requests
const delay = (ms) => {
    return new Promise((res) => {
        setTimeout(res, ms)
    })
}
// autocomplete query generator
async function autocomplete(text) {
    const q = `https://en.wikipedia.org/w/api.php?action=opensearch&limit=10&format=json&search=${text}&origin=*`
    
    return fetch(q).then(res => res.json())
}
// load page variables after DOM has loaded
function loadEls() {
    search = document.getElementById("search")
    autocomp = document.getElementById("autocomplete")
    graphEl = document.getElementById("graph")
    logger = document.getElementById("log")
    isnt = document.querySelector(".inst-cont")
    // click listener for instructions button
    document.querySelector("div.instructions").addEventListener("click", event => {
        isnt.classList.toggle("hidden")
    })
    // load force graph
    loadVisual()
    // autocomplete listener
    search.addEventListener("input", event => {
        // clear autocomplete if search is empty
        if (!search.value) {
            autocomp.innerHTML = ""
            return
        }
        // generate query then load autocomplete element
        autocomplete(search.value).then(data => {
            autocomp.innerHTML = ""
            // iterate over a maximum of 5 of the pages returned by the Wikipedia native autocomplete API
            for (let i=0; (i < data[1].length) && (i < 5); i++) {
                let entry = document.createElement("div")
                entry.className = "entry"
                entry.innerHTML = data[1][i]
                // when we click on an entry, search that entry
                entry.addEventListener("click", (event) => {
                    search.value = event.target.innerHTML
                    autocomp.innerHTML = ""
                    // initialize graph at search value assuming value from autocomplete will be an article
                    pageRoot(search.value).then(data => {
                        drawData(data)
                    })
                })

                autocomp.appendChild(entry)
            }
        })
    })
    // listen for enter and then initialize page
    search.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            autocomp.innerHTML = ""
            search.blur()
            // init graph from search
            pageRoot(search.value.trim()).then(data => {
                // if search value is not an article, log that there is no page there and escape
                if (!data) {
                    log("No page found for " + search.value, true, 2000)
                    return
                }
                drawData(data)
            })
        }
    })
    // cases for click events where the click element is not  
    window.addEventListener("click", event => {
        // cases wfor hiding autocomplete
        if (event.target.className !== "entry" && event.target.tagName !== "INPUT") {
            autocomp.innerHTML = ""
        }
        // messy but cases for hiding instructions
        if (event.target.tagName !== "DIV" || event.target.className === "search-cont") {
            isnt.classList.add("hidden")
        }
    })
}
// query generator for page
async function processPageWiki(page, depth=0, maxLinks=500) {
    // generate query link
    const link = "https://en.wikipedia.org/w/api.php?" + new URLSearchParams({
        origin: "*",
        action: "query",
        titles: page,
        format: "json",
        prop: "links",
        pllimit: maxLinks,
    })
    log("Getting links for " + page)
    // fetch query
    return fetch(link).then(data => data.json()).then(data => {
        // get pages data from API
        const pages = data.query.pages
        // if page doesnt exist or has no links
        if (pages["-1"]) return {
            links: [],
            title: page
        }
        // find object key and then get then first page returned by the search
        let sl = pages[Object.keys(data.query.pages)[0]]
        // filter links by title regex predefined
        sl.links = sl.links.filter(e => !e.title.match(titleRegex)).map(e => {
            // format elements for processor loop
            return [e.title, depth + 1, sl.title]
        })
        // flag object as ommittable if it has less than 2 links
        if (!sl.links || sl.links.length < 3) sl.canOmit
        return sl
    }).catch((err) => {log(err, true, 2000)})
}
// log function controls log element
function log(text, error, tm=1000) {
    // is red if errors remove at default case
    logger.classList.remove("logred")
    if (error) logger.classList.add("logred")
    logger.innerHTML = text
    // stop fading
    logger.classList.remove("fading")
    // reset timeout if exists
    clearTimeout(logtm)
    // wait 1 second before fading out
    logtm = setTimeout(() => {
        logger.classList.add("fading")
    }, tm)
}
// root for top-down traversal
function pageRoot(page, opt) {
    // if already loading escape
    if (loading) return new Promise((res) => res())
    // loading flag
    loading = true
    // default opt
    opt = {
        maxDepth: 2,
        maxNodes: 1100,
        maxInitial: 1000,
        childMax: 10,
        directed: true
    }
    // clear graph if exists
    if (Graph) Graph.graphData({
        nodes: [],
        links: []
    })
    // promise wrapper to resolve when finished for .then chaining
    return new Promise(async (res) => {
        // CAN MAYBE BE OMMITTED | check autocomplete to verify page
        let autocomp = await autocomplete(page)
        if (!autocomp || !autocomp[1] || autocomp[1].length < 1) {
            loading = false
            res()
            return
        }
        let data = await processPageWiki(page)
        // if not correct information escape and resolve promise
        if (!data || !data.title || !data.links || data.links.length === 0) {
            loading = false
            res()
            return
        }
        // if redirect, process page that it points to instead
        if (data.links.length === 1) {
            data = await processPageWiki(data.links[0][0])
            log("Redirected to " + data.title)
            search.value = data.title
        }
        // queue for top-down traversion
        let toProcess = data.links.slice(0, opt.maxInitial)
        // initialize nodes array
        let nodes = [{
            id: data.title,
            group: 0,
            color: colorScheme[0],
            nH: [],
            lH: [],
        }], links = []
        // initialize request count for bottleneck
        let promises = 0
        // visited for plotting paths and caching discovered nodes
        let visited = {}
        // initial values
        visited[data.title] = []
        // while there are items in the queue and there are ongoing requests
        while (toProcess.length > 0 || promises > 0) {
            // if there are over 100 pending promises and there are no links to process, bottleneck
            if (toProcess.length === 0 || promises > 100) {
                await delay(200)
                continue
            }
            // get item from queue
            let [item, depth, root] = toProcess.pop(0)
            // create link and node skeletons
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
            // if node has not been discovered, add to graph
            let found = visited[item]
            if (!found) {
                // add node and link to graph
                nodes.push(node)
                links.push(link)
                // mark item as visited
                visited[item] = []
                // if root has been discovered...
                if (visited[root]) {
                    // unpack the previous node's path
                    visited[item] = [node, ...visited[root]]
                    // visited[item].links = [link, ...visited[root].links]
                    // set nodes to highlight, path is derived from highlighted nodes
                    // node.lH = visited[item].links
                    node.lH = link
                    node.nH = visited[item]
                }
            }
            // if it is not a directed graph, add link anyways
            else if (!opt.directed) {
                links.push(link)
            }
            // depth cutoff
            if (depth < opt.maxDepth) {
                // add pending request
                promises += 1
                processPageWiki(item, depth, opt.childMax).then(innerDat => {
                    // if omit flag and nodes over soft limit, mark promise as done then escape
                    if (innerDat.canOmit && nodes.length >= opt.maxNodes) {
                        promises -= 1
                        return
                    }
                    // push to queue THEN subtract from promises on the off chance that the loop checks at the same time as we subtract, but we don't push to queue
                    if (innerDat && innerDat.links) toProcess.push(...innerDat.links)
                    promises -= 1
                })
            }
        }
        // format result
        let result = {
            links: links,
            nodes: nodes
        }
        // set loading flag
        loading = false
        // resolve promise
        res(result)
    })
}
// draw data on graph
function drawData(obj) {
    if (!obj) {
        log("No data to display!", true, 2000)
        return
    }
    // parse raw JSON string
    if (typeof obj === "string") obj = JSON.parse(obj)
    log("Loading graph...")
    
    Graph.graphData(obj)
    
    log("Successfully graphed data!")
}
// init graph
function loadVisual() {
    // set node relative size
    const NODE_R = 8
    // sets for highlighted nodes and links
    const hL = new Set()
    const hN = new Set()
    // first render flag
    let first = true
    // initialize hovered node reference
    let hoverNode = null
    // graph data using chaining to set options
    Graph = ForceGraph()(document.getElementById('graph'))
    .nodeId('id')
    .nodeVal('val')
    .linkSource('source')
    .linkTarget('target')
    .nodeRelSize(NODE_R)
    .enableNodeDrag(false)
    .onNodeHover(node => {
        // clear highlights for default
        hN.clear()
        hL.clear()
        // clear cursor for default
        graphEl.style.cursor = ""
        // if node at hover spot
        if (node) {
            // set cursor
            graphEl.style.cursor = "pointer"
            // add hovered node
            hN.add(node)
            function linkhelper(n) {

            }
            // add nodes and links in path to highlighted sets
            node.nH.forEach(n => {
                hL.add(n.lH)
                hN.add(n)
            })
            // node.nH.forEach(n => hN.add(n))
            // node.lH.forEach(l => hL.add(l))
        }
        // set hovered node reference
        hoverNode = node || null
    })
    .linkDirectionalArrowLength(6)
    .linkWidth(link => {
        // if link in highlighted links set, highlight
        return hL.has(link) ? 6 : 1
    })
    .linkDirectionalParticles(4)
    .linkDirectionalParticleWidth(link => {
        // if link is highlighted add particles
        return hL.has(link) ? 4 : 0
    })
    .nodeCanvasObjectMode(node => {
        // if node in highlighted set enable before render flag
        return hN.has(node) ? 'before' : undefined
    })
    .nodeCanvasObject((node, ctx) => {
        // set render callback function for highlighting node
        ctx.beginPath()
        ctx.arc(node.x, node.y, NODE_R * 1.4, 0, 2 * Math.PI, false)
        ctx.fillStyle = node === hoverNode ? '#E63946' : '#E48E59'
        ctx.fill()
    })
    .cooldownTicks(100)
    .cooldownTime(10000)
    .onNodeClick(node => {
        // go to wikipedia page on click
        window.open("https://en.wikipedia.org/wiki/" + node.id)
    })
    .onNodeRightClick(node => {
        // set new root for search at node value
        search.value = node.id
        pageRoot(node.id).then(data => drawData(data))
    })
    .nodeLabel(node => {
        // label placeholder element
        let cont = document.createElement("div")
        // path to node by unpacking the node highlight and reversing it, and then just joining it with ASCII arrows
        let pt = [node.mp, ...node.nH.map(e => e.id).reverse()].join(" 🡒 ")
        // page title
        let h1 = document.createElement("h1")
        h1.innerHTML = node.id
        h1.style.fontSize = "larger"
        h1.style.fontWeight = "bolder"
        cont.appendChild(h1)
        // if there is a path, append the text to the label
        if (pt) {
            let sp = document.createElement("span")
            sp.style.display = "block"
            sp.innerHTML = pt
            cont.appendChild(sp)
        }
        // return placeholder element inner HTML
        return cont.innerHTML
    })
    .onEngineStop(() => {
        // if first render zoom
        if (first) {
            first = false 
            Graph.zoomToFit(500)
        }
        // re-enable interactions
        Graph.enableNodeDrag(true).enableZoomInteraction(true)
    })
    // on resize also resize map
    window.addEventListener("resize", (event) => {
        Graph.height(window.innerHeight)
        Graph.width(window.innerWidth)
    })
}
