// Ensure data is sorted by birth year
timelineData.sort((a, b) => (a.birth_ysc || 0) - (b.birth_ysc || 0));

// ---- Presentation State ----
const maxSteps = timelineData.length;
// "reveal the time line at the end" -> Start at the end
let currentStep = maxSteps - 1;

// ---- Three.js Background ----
let scene, camera, renderer, particles;

function initThreeJS() {
    try {
        const container = document.getElementById('canvas-container');
        if (!container) return;
        
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x0b0c10, 0.001);

        const w = Math.max(10, window.innerWidth);
        const h = Math.max(10, window.innerHeight);

        camera = new THREE.PerspectiveCamera(75, w / h, 1, 2000);
        camera.position.z = 1000;

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(w, h);
        container.appendChild(renderer.domElement);

        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        for (let i = 0; i < 5000; i++) {
            const x = 2000 * Math.random() - 1000;
            const y = 2000 * Math.random() - 1000;
            const z = 2000 * Math.random() - 1000;
            vertices.push(x, y, z);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        
        const material = new THREE.PointsMaterial({ 
            color: 0xe2c044, 
            size: 2,
            transparent: true,
            opacity: 0.6
        });

        particles = new THREE.Points(geometry, material);
        scene.add(particles);

        const ambientLight = new THREE.AmbientLight(0x404040);
        scene.add(ambientLight);

        window.addEventListener('resize', onWindowResize, false);
        animateThreeJS();
    } catch (e) {
        console.error("Three.js error:", e);
    }
}

function onWindowResize() {
    if (!camera || !renderer) return;
    const w = Math.max(10, window.innerWidth);
    const h = Math.max(10, window.innerHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    resizeTimeline();
}

function animateThreeJS() {
    requestAnimationFrame(animateThreeJS);
    if (particles) {
        particles.rotation.x += 0.0002;
        particles.rotation.y += 0.0005;
    }
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

// ---- D3.js Timeline ----
let svg, chartArea, xAxisGroup, yAxisGroup, xScale, yScale;
let tWidth, tHeight;
const margin = {top: 20, right: 40, bottom: 30, left: 120}; 

function initTimeline() {
    try {
        const container = d3.select("#timeline-container");
        if (container.empty()) return;
        
        const node = container.node();
        tWidth = Math.max(10, node.getBoundingClientRect().width - margin.left - margin.right);
        tHeight = Math.max(10, node.getBoundingClientRect().height - margin.top - margin.bottom);

        svg = container.append("svg")
            .attr("width", tWidth + margin.left + margin.right)
            .attr("height", tHeight + margin.top + margin.bottom);

        chartArea = svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        xAxisGroup = chartArea.append("g")
            .attr("class", "axis x-axis")
            .attr("transform", `translate(0,${tHeight})`);

        yAxisGroup = chartArea.append("g")
            .attr("class", "axis y-axis");

        chartArea.append("g").attr("class", "grid x-grid");
    } catch (e) {
        console.error("D3 init error:", e);
    }
}

function resizeTimeline() {
    try {
        const container = d3.select("#timeline-container");
        if (container.empty()) return;
        
        const node = container.node();
        tWidth = Math.max(10, node.getBoundingClientRect().width - margin.left - margin.right);
        tHeight = Math.max(10, node.getBoundingClientRect().height - margin.top - margin.bottom);

        svg.attr("width", tWidth + margin.left + margin.right)
           .attr("height", tHeight + margin.top + margin.bottom);

        xAxisGroup.attr("transform", `translate(0,${tHeight})`);
        
        updateTimeline(currentStep, 0);
    } catch (e) {
        console.error("Resize error:", e);
    }
}

function updateTimeline(stepIndex, duration = 1000) {
    try {
        if (!timelineData || timelineData.length === 0) return;
        
        const visibleData = timelineData.slice(0, stepIndex + 1);

        const minX = 0;
        let maxX = d3.max(visibleData, d => d.death_ysc);
        if (maxX === undefined || maxX === null || isNaN(maxX)) {
            maxX = 100;
        }

        xScale = d3.scaleLinear()
            .domain([minX, maxX + 50]) 
            .range([0, tWidth]);

        yScale = d3.scaleBand()
            .domain(visibleData.map(d => d.name))
            .range([0, tHeight])
            .padding(0.3);

        const xAxis = d3.axisBottom(xScale).tickFormat(d => Math.floor(d));
        const yAxis = d3.axisLeft(yScale);

        xAxisGroup.transition().duration(duration).call(xAxis);
        yAxisGroup.transition().duration(duration).call(yAxis);

        const xGrid = d3.axisBottom(xScale).tickSize(-tHeight).tickFormat("");
        chartArea.select(".x-grid")
            .attr("transform", `translate(0,${tHeight})`)
            .transition().duration(duration)
            .call(xGrid);

        const barGroups = chartArea.selectAll(".bar-group")
            .data(visibleData, d => d.name);

        const barGroupsEnter = barGroups.enter()
            .append("g")
            .attr("class", "bar-group")
            .attr("transform", d => `translate(0, ${yScale(d.name) || 0})`)
            .style("opacity", 0);

        barGroupsEnter.append("rect")
            .attr("class", "segment-before")
            .attr("fill", "var(--accent-blue)")
            .attr("rx", 4)
            .on("mouseover", (e, d) => showTooltip(e, d, 'before'))
            .on("mouseout", hideTooltip);

        barGroupsEnter.append("rect")
            .attr("class", "segment-after")
            .attr("fill", "var(--accent-gold)")
            .attr("rx", 4)
            .on("mouseover", (e, d) => showTooltip(e, d, 'after'))
            .on("mouseout", hideTooltip);

        const allBarGroups = barGroupsEnter.merge(barGroups);

        allBarGroups.transition().duration(duration)
            .attr("transform", d => `translate(0, ${yScale(d.name) || 0})`)
            .style("opacity", 1);

        allBarGroups.select(".segment-before")
            .transition().duration(duration)
            .attr("x", d => xScale(d.birth_ysc || 0))
            .attr("width", d => {
                const start = xScale(d.birth_ysc || 0);
                const end = xScale(d.son_born_ysc !== null ? d.son_born_ysc : (d.birth_ysc || 0));
                return Math.max(0, end - start);
            })
            .attr("height", yScale.bandwidth());

        allBarGroups.select(".segment-after")
            .transition().duration(duration)
            .attr("x", d => xScale(d.son_born_ysc !== null ? d.son_born_ysc : (d.birth_ysc || 0)))
            .attr("width", d => {
                const start = xScale(d.son_born_ysc !== null ? d.son_born_ysc : (d.birth_ysc || 0));
                const end = xScale(d.death_ysc !== null ? d.death_ysc : (d.birth_ysc || 0));
                return Math.max(0, end - start);
            })
            .attr("height", yScale.bandwidth());

        barGroups.exit()
            .transition().duration(duration)
            .style("opacity", 0)
            .remove();
            
    } catch (e) {
        console.error("D3 render error:", e);
    }
}

const tooltip = d3.select("#tooltip");

function showTooltip(event, d, period) {
    try {
        let periodTitle = period === 'before' ? "కుమారుడు పుట్టే వరకు" : "కుమారుడు పుట్టిన తర్వాత";
        let periodRange = period === 'before' ? `${d.birth_ysc || 0} - ${d.son_born_ysc || d.birth_ysc || 0}` : `${d.son_born_ysc || d.birth_ysc || 0} - ${d.death_ysc || d.son_born_ysc || 0}`;
        
        tooltip.html(`
            <div class="tooltip-title">${d.name} <span style="font-size: 1rem; opacity: 0.8; font-weight: normal;">(${periodTitle})</span></div>
            <div class="tooltip-stats">
                <div class="tooltip-stat-box">
                    <span class="tooltip-stat-label">కుమారుడు పుట్టిన వయస్సు</span>
                    <span class="tooltip-stat-value">${d.age_at_son || '-'}</span>
                </div>
                <div class="tooltip-stat-box">
                    <span class="tooltip-stat-label">మొత్తం ఆయుష్షు</span>
                    <span class="tooltip-stat-value">${d.total_age || '-'}</span>
                </div>
                <div class="tooltip-stat-box">
                    <span class="tooltip-stat-label">సృష్టి నుండి కాలం</span>
                    <span class="tooltip-stat-value" style="font-size: 1.1rem; margin-top: 5px;">${periodRange}</span>
                </div>
            </div>
            <div class="tooltip-verses">
                <p>${d.ref_son || ''}</p>
                <p>${d.ref_after || ''}</p>
            </div>
        `);

        let leftPos = event.pageX + 20;
        let topPos = event.pageY - 60;
        
        if (leftPos + 400 > window.innerWidth) {
            leftPos = event.pageX - 420;
        }

        tooltip.classed("hidden", false)
               .style("left", leftPos + "px")
               .style("top", topPos + "px");
               
        d3.select(event.currentTarget).attr("opacity", 0.7);
    } catch (e) {
        console.error("Tooltip error:", e);
    }
}

function hideTooltip(event) {
    tooltip.classed("hidden", true);
    d3.select(event.currentTarget).attr("opacity", 1);
}

// ---- Keyboard Navigation ----
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
        if (currentStep < maxSteps - 1) {
            currentStep++;
            updateTimeline(currentStep);
        }
    } else if (e.key === 'ArrowLeft') {
        if (currentStep > 0) {
            currentStep--;
            updateTimeline(currentStep);
        }
    }
});

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initThreeJS();
    initTimeline();
    updateTimeline(currentStep);
});
