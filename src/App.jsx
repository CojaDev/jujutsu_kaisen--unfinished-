import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import {
  useBox,
  Physics,
  Debug,
  usePlane,
  useContactMaterial,
} from '@react-three/cannon';
import { Stars, Sky, Plane } from '@react-three/drei';
import { TextureLoader } from 'three/src/loaders/TextureLoader';
import GroundTexture from './assets/textures/Texture.png';
import PlayerCollider from './Components/Player';
import TransparentGroundTexture from './assets/textures/transparent_ground.png'; // Replace with the path to your transparent texture
import create from 'zustand';
import domainSound from './assets/sounds/domain.mp3';
import { AnimationMixer } from 'three';
import { useSound } from 'use-sound';
import * as THREE from 'three';
import heightMap from './assets/textures/Heightmap.png';
import normalMap from './assets/textures/NormalMap.png';

export const useStore = create((set) => ({
  groundObjects: {},
  actions: {},
  mixer: new AnimationMixer(),
  domainExpansion: false,
  setDomainExpansion: (value) => set({ domainExpansion: value }), // Add setter function
}));

const Ground = () => {
  const [ref] = usePlane(
    () => ({
      rotation: [-Math.PI / 2, 0, 0],
      args: [20, 20, 95, 95], // Set the width and height of your terrain
      type: 'Static', // The ground is static, it doesn't move
      userData: { id: 'ground' }, // Assign a user data ID for contact material
      material: 'ground',
    }),
    useRef()
  );
  useContactMaterial('ground', 'slippery', {
    friction: 0,
    restitution: 0.01,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3,
  });
  const elevtion = useLoader(THREE.TextureLoader, heightMap);
  const normal = useLoader(THREE.TextureLoader, normalMap);

  const texture = useLoader(TextureLoader, GroundTexture, (loader) => {
    loader.minFilter = THREE.LinearMipmapLinearFilter;
    loader.generateMipmaps = true;
  });
  const TraTexture = useLoader(
    TextureLoader,
    TransparentGroundTexture,
    (loader) => {
      loader.minFilter = THREE.LinearMipmapLinearFilter;
      loader.generateMipmaps = true;
    }
  );

  const domainExpansion = useStore((state) => state.domainExpansion);
  const groundObjects = useStore((state) => state.groundObjects);

  useEffect(() => {
    const id = ref.current.id;
    groundObjects[id] = ref.current;
    return () => {
      delete groundObjects[id];
    };
  }, [groundObjects, ref]);

  const terrainGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(20, 20, 95, 95);
    geometry.computeBoundingBox();
    return geometry;
  }, []);

  const material = useRef(
    new THREE.MeshStandardMaterial({
      map: domainExpansion ? TraTexture : texture,
      displacementMap: elevtion,
      normalMap: normal,
      transparent: true,
      opacity: domainExpansion ? 0.5 : 1,
      alphaTest: 0.5,
    })
  );

  useEffect(() => {
    material.current.map = domainExpansion ? TraTexture : texture;
    material.current.displacementMap = elevtion;
    material.current.normalMap = normal;
    material.current.opacity = domainExpansion ? 0.5 : 1;
  }, [domainExpansion, texture, TraTexture, elevtion, normal]);

  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={8}
      position={[0, 0, 0]}
    >
      <primitive object={terrainGeometry} attach="geometry" />
      <meshStandardMaterial
        attach="material"
        map={texture}
        displacementMap={elevtion}
        normalMap={normal}
      />
    </mesh>
  );
};
const App = () => {
  const stars = useRef();
  const domainExpansion = useStore((state) => state.domainExpansion);
  const setDomainExpansion = useStore((state) => state.setDomainExpansion);
  const [domainExpansionTimer, setDomainExpansionTimer] = useState(0);
  const rotationSpeed = 0.008; // Adjust the rotation speed as needed
  const [playDomainSound, { stop }] = useSound(domainSound);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const updateRotation = () => {
      if (stars.current && domainExpansion) {
        stars.current.rotation.x += rotationSpeed;
        stars.current.rotation.y += rotationSpeed;
        stars.current.rotation.z += rotationSpeed;
      }
    };

    const animationId = {
      current: requestAnimationFrame(function animate() {
        updateRotation();
        animationId.current = requestAnimationFrame(animate);
      }),
    };

    return () => cancelAnimationFrame(animationId.current);
  }, [rotationSpeed, domainExpansion]);

  useEffect(() => {
    if (domainExpansionTimer > 0) {
      const timerId = setTimeout(() => {
        stop();
        setStarted(false);
        setDomainExpansion(false);
        setDomainExpansionTimer(0);
      }, domainExpansionTimer);
      return () => clearTimeout(timerId);
    }
  }, [domainExpansionTimer, stop, setDomainExpansion]);

  const handleKeyDown = (event) => {
    if (event.code === 'KeyF' && started === false) {
      setStarted(true);
      playDomainSound();

      setTimeout(() => {
        setDomainExpansion(true);
        setDomainExpansionTimer(20000); // 20 seconds
      }, 5000);
    }
  };

  return (
    <main
      className={`w-screen h-screen ${
        domainExpansion ? 'bg-gray-900' : 'bg-blue-500'
      }`}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <Canvas
        style={{ width: '100vw', height: '100vh' }}
        camera={{ fov: 70 }}
        onPointerDown={(e) => e.target.requestPointerLock()}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <directionalLight position={[6, 10, 1]} />
          <ambientLight />
          {!domainExpansion && (
            <Sky
              sunPosition={[6, 10, 1]}
              rayleigh={0.1}
              mieCoefficient={0.002}
            />
          )}

          <Stars
            radius={domainExpansion ? 0.0002 : 120}
            fade={true}
            count={domainExpansion ? 5000 : 1000}
            rotation={[domainExpansion ? 0 : rotationSpeed * 1000, 0, 0]}
            ref={stars}
          />
          <Physics>
            <PlayerCollider position={[-40, 0.5, -30]} />

            <Ground />
          </Physics>
        </Suspense>
      </Canvas>
    </main>
  );
};

export default App;
