// svg size
const width = window.innerWidth;
const height = window.innerHeight;

// treemap/svg margin
const marginLeft = 20;
const marginRight = 20;
const marginTop = 70;
const marginBottom = 20;

const packagePadding = 1; // padding between packages
const packageInnerPadding = 3; // padding inside package
const domainPaddingTop = 20;
const domainPaddingLeft = 5;
const domainPaddingRight = 1;
const domainPaddingBottom = 1;

// font
const fontFamily = "Helvetica, Arial, sans-serif";

// title
const titleFontSize ="1.4em";
const titleFontFamily = fontFamily;
const dateFormat = "%b '%y"; // see https://github.com/d3/d3-time-format for format definition

// package text
const packageFontSize = "0.8em";
const packageLineHeight = "0.9em";
const packageFontColor = "#fff";
const splitPackageName = true;

// domain text
const drawDomainText = true;
const domainFontSize ="0.8em";
const domainFontFamily = fontFamily;
const domainFontColor ="#000";
const domainFontWeight = "bold"; // see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/font-weight
const domainTextOffsetX = packageInnerPadding; // use packageInnerPadding to align with the package text 
const domainTextOffsetY = 4;

// animation
const animationTime = 300;
const transitionTimeRatio = 3/4;

// rectangles
const useFileCountForSize = true; // if false, the size if proportinal to the package name's length
const minimumSize = 44; // minimum size when using file count
const drawBorder = false; // draw a border around the squares
const borderColor = "#000";
const borderWidth = "1px";

// rectangle appearance
const innerPadding = 1; // padding between the group squares
const outerPadding = 4; // padding between domains 


// do not modify past this point

const container = d3.select("#container");
const container2 = d3.select("#container2");
const transitionTime = animationTime * transitionTimeRatio;

function myTransition() {
    return d3.transition()
	.duration(transitionTime)
        .ease(d3.easeQuad);
}

const mysvg = container.append("svg")
	.attr("viewBox", [-marginLeft, -marginRight, width, height])
	.attr("width", width)
	.attr("height", height)
      .attr("style", "max-width: 100%, height: auto, height: intrinsic;");

const treeGroup = mysvg.append("g")

const treemap = d3.treemap()
      .size([width - marginLeft - marginRight, height - marginTop - marginBottom])
      .tile(d3.treemapResquarify)
//      .tile(d3.treemapBinary)
      .paddingInner(packagePadding)
      .paddingTop(domainPaddingTop)
      .paddingLeft(domainPaddingLeft)
      .paddingRight(domainPaddingRight)
      .paddingBottom(domainPaddingBottom)
      .round(true)

const domains = new Set();
dataJson.forEach(d => d.forEach(e => domains.add(e.domain)));

const colorScheme = [
    "#624584",
    "#7d27a5",
    "#9b2246",
    "#65501f",
    "#993e00",
    "#0159bc",
    "#8a5000",
    "#cf0071",
    "#c84a00",
    "#8a57e0",
    "#c645c9",
    "#f02f45",
    "#9c8050",
    "#789000",
    "#ff4b74",
    "#588bff",
    "#b09900",
    "#a698ff",
    "#59c237",
    "#57b9ff",
    "#ffa87b",
    "#ffae4b",
    "#ffa8e1",
    "#9ad496",
    "#91d877",
    "#d4bcf4",
    "#bdd052",
    "#96d946",
    "#e9bf90",
    "#eac250"] .map(c => {
	let c1 = d3.hsl(c);
	// c1.s += 0.1;
	// c1.l += 0.2;
	// c1.h = (c1.h + 360) % 360
	// c1.opacity = 1;
	return c1.clamp() + ""})

const myColor = d3.scaleOrdinal()
      .range(colorScheme)
      .domain(domains)

const posScale = d3.scaleOrdinal()
      .range([0, domains.length])
      .domain(domains)

const dateFormatter = d3.timeFormat(dateFormat);

function draw(data, svg) {
    let root = d3.hierarchy(d3.group(data, d => d.domain))

    root.sum(d => {
	if (useFileCountForSize) {
	    return Math.max(d ? d.fileCount : minimumSize, minimumSize);
	} else {
	   return d ? d.size : 1
	}
    })

    root.sort((a, b) => {
	if (posScale(a.domain) == posScale(b.domain)) {
	    return a.package < b.package
	}
	
	return posScale(a.domain) < posScale(b.domain)
    })
    root.descendants().forEach((d, i) => d.index = i);
    tree(root, svg);
};

function tree(root, svg) {
    treemap(root);
    const leaves = root.leaves();
    
   const defs = svg.selectAll("defs")
	.data([0])
	.join("defs")

    const clips = 
	  defs.selectAll("clipPath.package")
	  .data(leaves)
	  .join("clipPath")
	  .attr("id", d => `clip-${d.data.package}`)
          .attr("class", "package")
    
    clips.selectAll("rect")
	.data(d => d)
	.join("rect")
	.attr("width", d => d.x1 - d.x0 /* - paddingLeft */)
	.attr("height", d => d.y1 - d.y0  /* - paddingTop */)

    const r = treeGroup.selectAll("rect")
	.data(leaves)
	.join(
	    enter => enter.append("rect")
		.attr("transform", d => `translate(${(d.x0 + d.x1) / 2}, ${(d.y0 + d.y1) / 2})`)
		.attr("fill", d => myColor(d.data.domain))
		.call(enter => enter.transition(myTransition())
		    .attr("transform", d => `translate(${d.x0}, ${d.y0})`)
		    .attr("width", d => d.x1 - d.x0)
		    .attr("height", d => d.y1 - d.y0)),

	    update => update.call(update => update.transition(myTransition())
		.attr("transform", d => `translate(${d.x0}, ${d.y0})`)
		.attr("fill", d => myColor(d.data.domain))
		.attr("width", d => d.x1 - d.x0)
		.attr("height", d => d.y1 - d.y0)),

	    exit => exit.call(exit => exit.transition(myTransition())
		.attr("transform", d => `translate(${d.x1}, ${d.y1})`)
		.attr("width", 0)
		.attr("height", 0))
	);

    if (drawBorder) {
	r.style("stroke", borderColor)
	    .style("stroke-witdth", d => drawBorder ? borderWidth : 0)
    }

    if (drawDomainText) {
	const domainClips = 
	    defs.selectAll("clipPath.domain")
	    .data(root.children.filter(d => d.depth == 1))
	    .join("clipPath")
	    .attr("id", d => `clip-domain-${d.data[0]}`)
	      .attr("class", "domain");
	
	domainClips.selectAll("rect")
	    .data(d => d)
	    .join("rect")
	    .attr("width", d => d.x1 - d.x0 - domainTextOffsetX - domainPaddingLeft)
	    .attr("height", d => d.y1 - d.y0)

	const domainTitles = treeGroup.selectAll("text.domain")
	      .data(root.children.filter(d => d.depth == 1))
	      .join("text")
	      .attr("class", "domain")
	      .attr("font-weight", domainFontWeight) 
	      .attr("clip-path", d => `url(#clip-domain-${d.data ? d.data[0] : d.index})`)
	      .text(d => d.data[0])
	      .attr("x", 0)
	      .attr("y", domainFontSize)
	      .attr("dx", domainTextOffsetX)
	      .attr("dy", domainTextOffsetY)
	      .attr("text-anchor", "start")
	      .attr("fill", domainFontColor)
	      .attr("font-family", fontFamily)
	      .attr("font-size", domainFontSize)
	      .call( text => text.transition(myTransition())
		     .attr("transform", d => `translate(${d.x0 + domainPaddingLeft}, ${d.y0})`));
    }

    const t = svg.selectAll("text.package")
	  .data(leaves)
	  .join("text")
          .attr("class", "package")
          .attr("font-family", fontFamily)
          .attr("font-size", packageFontSize) 
	  .attr("x", packageInnerPadding)
	  .attr("y", packageInnerPadding)
	  .attr("clip-path", d => `url(#clip-${d.data ? d.data.package : d.index})`)
	  .attr("fill", d => packageFontColor)
	  .call( text => text.transition(myTransition())
		 .attr("transform", d => `translate(${d.x0}, ${d.y0})`))
	  .selectAll("tspan")
	  .data(d => splitPackageName ? d.data.package.split('-'): [d.data.package])
		.join("tspan")
	  .attr("x", packageInnerPadding)
	  .attr("dy", packageLineHeight)
	  .text(d => d)

    svg.selectAll("#time")
	.data(leaves[0])
	.join("text")
        .attr("id", "time")
        .attr("text-anchor", "middle")
        .attr("font-family", titleFontFamily)
        .attr("font-size", titleFontSize)
        .attr("x", width / 2)
        .attr("y", 0)
	.text(d => dateFormatter(d3.isoParse(d.data.when)));
}

var index = dataJson.length - 1;
var intervalId;

function redraw() {
    if (index <= 0) {
	index = dataJson.length - 1;
    }
    draw(dataJson[index], mysvg);
    index--;
};

function pauseDraw(event) {
   clearInterval(intervalId);
}

function startDraw(event) {
    intervalId = setInterval(redraw, animationTime);
}

draw(dataJson[0], mysvg);
