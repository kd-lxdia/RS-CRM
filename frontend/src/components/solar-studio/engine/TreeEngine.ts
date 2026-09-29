import * as THREE from 'three';

// Simple deterministic pseudo-random generator
function randomSeed(s: number) {
  return function() {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };
}

export function generateTreeMeshes(type: string, trunkHeight: number, crownRadius: number, crownHeight: number, seed: number = 1) {
  const rand = randomSeed(seed);
  
  const visualGroup = new THREE.Group();
  const shadowProxy = new THREE.Group();

  // Common Trunk (visual and shadow)
  const trunkGeo = new THREE.CylinderGeometry(crownRadius * 0.1, crownRadius * 0.15, trunkHeight, 8);
  trunkGeo.translate(0, trunkHeight / 2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  visualGroup.add(trunkMesh);
  
  const trunkShadow = new THREE.Mesh(trunkGeo, new THREE.MeshBasicMaterial());
  trunkShadow.castShadow = true;
  shadowProxy.add(trunkShadow);

  const crownCenterY = trunkHeight + crownHeight / 2;
  const crownMat = new THREE.MeshStandardMaterial({ 
    color: type === 'pine' ? '#2d5a27' : '#3a5f0b', 
    roughness: 0.8,
    transparent: true,
    opacity: 0.9
  });

  if (type === 'pine' || type === 'conifer') {
    // Pine: stacked cones
    const levels = 3;
    for (let i = 0; i < levels; i++) {
      const radius = crownRadius * (1 - i * 0.25);
      const height = crownHeight * 0.5;
      const yPos = trunkHeight + i * (crownHeight * 0.25) + height / 2;
      
      const coneGeo = new THREE.ConeGeometry(radius, height, 16);
      coneGeo.translate(0, yPos, 0);
      visualGroup.add(new THREE.Mesh(coneGeo, crownMat));
      
      // Shadow proxy: lower poly cone
      const shadowConeGeo = new THREE.ConeGeometry(radius, height, 8);
      shadowConeGeo.translate(0, yPos, 0);
      const shadowMesh = new THREE.Mesh(shadowConeGeo, new THREE.MeshBasicMaterial());
      shadowMesh.castShadow = true;
      shadowProxy.add(shadowMesh);
    }
  } else if (type === 'oak') {
    // Oak: noisy sphere clusters
    const numClusters = 5;
    for(let i=0; i<numClusters; i++) {
      const cr = crownRadius * (0.6 + rand() * 0.4);
      const cx = (rand() - 0.5) * crownRadius * 0.8;
      const cy = crownCenterY + (rand() - 0.5) * crownHeight * 0.4;
      const cz = (rand() - 0.5) * crownRadius * 0.8;
      
      const sphereGeo = new THREE.SphereGeometry(cr, 16, 16);
      
      // Deform vertices
      const pos = sphereGeo.attributes.position;
      for(let j=0; j<pos.count; j++) {
        const factor = 1 + (rand() - 0.5) * 0.2;
        pos.setXYZ(j, pos.getX(j)*factor, pos.getY(j)*factor, pos.getZ(j)*factor);
      }
      sphereGeo.computeVertexNormals();
      sphereGeo.translate(cx, cy, cz);
      
      visualGroup.add(new THREE.Mesh(sphereGeo, crownMat));
      
      // Shadow proxy: low poly icosahedron
      const shadowGeo = new THREE.IcosahedronGeometry(cr, 0);
      shadowGeo.translate(cx, cy, cz);
      const shadowMesh = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial());
      shadowMesh.castShadow = true;
      shadowProxy.add(shadowMesh);
    }
  } else if (type === 'palm') {
    // Palm: long curved trunk, leaf planes
    // Skip curved trunk for now to keep shadow alignment simple
    const leafMat = new THREE.MeshStandardMaterial({ color: '#4caf50', side: THREE.DoubleSide });
    const numLeaves = 8;
    for(let i=0; i<numLeaves; i++) {
      const leafGeo = new THREE.PlaneGeometry(crownRadius * 0.5, crownRadius * 2);
      leafGeo.translate(0, crownRadius, 0);
      leafGeo.rotateX(Math.PI / 4 + rand() * 0.5);
      leafGeo.rotateY((i / numLeaves) * Math.PI * 2);
      leafGeo.translate(0, trunkHeight, 0);
      
      visualGroup.add(new THREE.Mesh(leafGeo, leafMat));
    }
    // Shadow proxy: simple upside-down cone
    const shadowGeo = new THREE.ConeGeometry(crownRadius, crownRadius, 8);
    shadowGeo.rotateX(Math.PI);
    shadowGeo.translate(0, trunkHeight, 0);
    const shadowMesh = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial());
    shadowMesh.castShadow = true;
    shadowProxy.add(shadowMesh);
    
  } else {
    // Round / default: simple ellipsoid
    const sphereGeo = new THREE.SphereGeometry(1, 24, 24);
    sphereGeo.scale(crownRadius, crownHeight / 2, crownRadius);
    
    // Deform
    const pos = sphereGeo.attributes.position;
    for(let j=0; j<pos.count; j++) {
      const factor = 1 + (rand() - 0.5) * 0.1;
      pos.setXYZ(j, pos.getX(j)*factor, pos.getY(j)*factor, pos.getZ(j)*factor);
    }
    sphereGeo.computeVertexNormals();
    sphereGeo.translate(0, crownCenterY, 0);
    
    visualGroup.add(new THREE.Mesh(sphereGeo, crownMat));
    
    // Shadow proxy
    const shadowGeo = new THREE.IcosahedronGeometry(1, 1);
    shadowGeo.scale(crownRadius, crownHeight / 2, crownRadius);
    shadowGeo.translate(0, crownCenterY, 0);
    const shadowMesh = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial());
    shadowMesh.castShadow = true;
    shadowProxy.add(shadowMesh);
  }

  // Ensure shadow proxies are invisible in the scene but cast shadows
  shadowProxy.children.forEach(c => {
    const m = c as THREE.Mesh;
    (m.material as THREE.Material).visible = false;
    m.castShadow = true;
  });

  // Visual meshes don't cast real heavy shadows, they use the proxy
  visualGroup.children.forEach(c => {
    const m = c as THREE.Mesh;
    m.castShadow = false;
    m.receiveShadow = true;
  });

  return { visualGroup, shadowProxy };
}
