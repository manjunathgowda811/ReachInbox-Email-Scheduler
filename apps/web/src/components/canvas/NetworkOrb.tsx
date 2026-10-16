'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface NetworkOrbProps {
  className?: string;
  particleCount?: number;
  interactive?: boolean;
}

export function NetworkOrb({
  className = 'w-full h-full',
  particleCount = 140,
  interactive = true,
}: NetworkOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Check WebGL availability
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setHasWebGL(false);
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 22;

    // Group to hold the entire orb structure
    const orbGroup = new THREE.Group();
    scene.add(orbGroup);

    // 1. Central Core Wireframe (Icosahedron)
    const coreGeo = new THREE.IcosahedronGeometry(4.8, 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x4f46e5,
      wireframe: true,
      transparent: true,
      opacity: 0.18,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    orbGroup.add(coreMesh);

    // 2. Inner Glowing Core Points (Nodes)
    const nodeCount = 60;
    const nodePositions = new Float32Array(nodeCount * 3);
    const nodeColors = new Float32Array(nodeCount * 3);

    const colorIndigo = new THREE.Color(0x818cf8);
    const colorCyan = new THREE.Color(0x38bdf8);
    const colorEmerald = new THREE.Color(0x34d399);

    for (let i = 0; i < nodeCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 4.7 + (Math.random() - 0.5) * 0.4;

      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      nodePositions[i * 3] = x;
      nodePositions[i * 3 + 1] = y;
      nodePositions[i * 3 + 2] = z;

      const randColor = i % 3 === 0 ? colorCyan : i % 3 === 1 ? colorEmerald : colorIndigo;
      nodeColors[i * 3] = randColor.r;
      nodeColors[i * 3 + 1] = randColor.g;
      nodeColors[i * 3 + 2] = randColor.b;
    }

    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
    nodeGeo.setAttribute('color', new THREE.BufferAttribute(nodeColors, 3));

    const nodeMat = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
    });
    const nodes = new THREE.Points(nodeGeo, nodeMat);
    orbGroup.add(nodes);

    // 3. Orbital Data Rings
    const createRing = (radius: number, tiltX: number, tiltY: number, color: number, opacity: number) => {
      const ringGeo = new THREE.RingGeometry(radius - 0.03, radius + 0.03, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color,
        side: THREE.DoubleSide,
        transparent: true,
        opacity,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = tiltX;
      ring.rotation.y = tiltY;
      return ring;
    };

    const ring1 = createRing(6.4, Math.PI / 3, Math.PI / 6, 0x6366f1, 0.4);
    const ring2 = createRing(7.2, -Math.PI / 4, Math.PI / 4, 0x38bdf8, 0.3);
    const ring3 = createRing(8.0, Math.PI / 2.2, 0, 0x10b981, 0.25);
    orbGroup.add(ring1);
    orbGroup.add(ring2);
    orbGroup.add(ring3);

    // 4. Data Packets (Pulsing particles travelling along the rings)
    const packetGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const packetMat1 = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const packetMat2 = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const packetMat3 = new THREE.MeshBasicMaterial({ color: 0xa855f7 });

    const packet1 = new THREE.Mesh(packetGeo, packetMat1);
    const packet2 = new THREE.Mesh(packetGeo, packetMat2);
    const packet3 = new THREE.Mesh(packetGeo, packetMat3);
    orbGroup.add(packet1);
    orbGroup.add(packet2);
    orbGroup.add(packet3);

    // 5. Cloud of ambient telemetry stars
    const starCount = particleCount;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 35;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 35;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.12,
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.5,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Mouse Tracking for Parallax / Look-at
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetX = x * 0.45;
      targetY = y * 0.45;
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    // Resize handler
    const handleResize = () => {
      if (!container || !renderer) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Visibility Observer to pause loop when offscreen
    let isVisible = true;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          isVisible = entry.isIntersecting;
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(container);

    // Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (!isVisible) return;

      const elapsed = clock.getElapsedTime();
      const speedMultiplier = prefersReducedMotion ? 0.2 : 1.0;

      // Parallax lerp
      currentX += (targetX - currentX) * 0.05;
      currentY += (targetY - currentY) * 0.05;

      // Core rotation
      orbGroup.rotation.y = elapsed * 0.15 * speedMultiplier + currentX;
      orbGroup.rotation.x = Math.sin(elapsed * 0.1) * 0.15 + currentY;

      // Ring rotations
      ring1.rotation.z = elapsed * 0.3 * speedMultiplier;
      ring2.rotation.z = -elapsed * 0.25 * speedMultiplier;
      ring3.rotation.z = elapsed * 0.2 * speedMultiplier;

      // Packet orbits
      const angle1 = elapsed * 0.9 * speedMultiplier;
      packet1.position.x = Math.cos(angle1) * 6.4;
      packet1.position.y = Math.sin(angle1) * 6.4 * Math.cos(Math.PI / 3);
      packet1.position.z = Math.sin(angle1) * 6.4 * Math.sin(Math.PI / 3);

      const angle2 = -elapsed * 0.8 * speedMultiplier;
      packet2.position.x = Math.cos(angle2) * 7.2 * Math.cos(Math.PI / 4);
      packet2.position.y = Math.sin(angle2) * 7.2;
      packet2.position.z = Math.cos(angle2) * 7.2 * Math.sin(-Math.PI / 4);

      const angle3 = elapsed * 0.6 * speedMultiplier;
      packet3.position.x = Math.cos(angle3) * 8.0;
      packet3.position.y = Math.sin(angle3) * 8.0 * Math.cos(Math.PI / 2.2);
      packet3.position.z = Math.sin(angle3) * 8.0 * Math.sin(Math.PI / 2.2);

      // Star twinkle
      stars.rotation.y = -elapsed * 0.02 * speedMultiplier;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
      window.removeEventListener('resize', handleResize);
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
      }

      // Memory cleanup
      coreGeo.dispose();
      coreMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      packetGeo.dispose();
      packetMat1.dispose();
      packetMat2.dispose();
      packetMat3.dispose();
      starGeo.dispose();
      starMat.dispose();
      renderer.dispose();
    };
  }, [particleCount, interactive]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden pointer-events-none select-none ${className}`}>
      {hasWebGL ? (
        <canvas ref={canvasRef} className="w-full h-full block" />
      ) : (
        /* Graceful CSS Fallback */
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-48 h-48 rounded-full border border-brand-500/30 animate-pulse bg-gradient-to-tr from-brand-600/20 via-brand-cyan/10 to-transparent blur-md" />
        </div>
      )}
    </div>
  );
}
