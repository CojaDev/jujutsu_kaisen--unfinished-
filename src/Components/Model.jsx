import { useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useEffect } from 'react';
import { useStore } from '../App';
import idleAnim from '../assets/models/character/idle.glb';
import walkAnim from '../assets/models/character/walk2.glb';
import runAnim from '../assets/models/character/run.glb';
import leftAnim from '../assets/models/character/left.glb';
import rightAnim from '../assets/models/character/right.glb';
import guardAnim from '../assets/models/character/guard.glb';
import blueAnim from '../assets/models/character/blue.glb';
import redAnim from '../assets/models/character/red.glb';
import purpleAnim from '../assets/models/character/hollow.glb';
import domainAnim from '../assets/models/character/domain.glb';

export default function Model() {
  const ref = useRef();
  const { nodes, materials } = useGLTF(
    'https://cdn.jsdelivr.net/gh/Sean-Bradley/React-Three-Fiber-Boilerplate@followCam/public/models/eve.glb'
  );
  const idleAnimation = useGLTF(idleAnim).animations;
  const walkAnimation = useGLTF(walkAnim).animations;
  const runAnimation = useGLTF(runAnim).animations;
  const jumpAnimation = useGLTF(
    'https://cdn.jsdelivr.net/gh/Sean-Bradley/React-Three-Fiber-Boilerplate@followCam/public/models/eve@jump.glb'
  ).animations;
  const leftAnimation = useGLTF(leftAnim).animations;
  const rightAnimation = useGLTF(rightAnim).animations;
  const guardAnimation = useGLTF(guardAnim).animations;
  const blueAnimation = useGLTF(blueAnim).animations;
  const redAnimation = useGLTF(redAnim).animations;
  const purpleAnimation = useGLTF(purpleAnim).animations;
  const domainAnimation = useGLTF(domainAnim).animations;

  const { actions, mixer } = useStore((state) => state);

  useEffect(() => {
    actions['idle'] = mixer.clipAction(idleAnimation[0], ref.current);
    actions['walk'] = mixer.clipAction(walkAnimation[0], ref.current);
    actions['jump'] = mixer.clipAction(jumpAnimation[0], ref.current);
    actions['run'] = mixer.clipAction(runAnimation[0], ref.current);
    actions['left'] = mixer.clipAction(leftAnimation[0], ref.current);
    actions['right'] = mixer.clipAction(rightAnimation[0], ref.current);
    actions['guard'] = mixer.clipAction(guardAnimation[0], ref.current);
    actions['blue'] = mixer.clipAction(blueAnimation[0], ref.current);
    actions['red'] = mixer.clipAction(redAnimation[0], ref.current);
    actions['purple'] = mixer.clipAction(purpleAnimation[0], ref.current);
    actions['domain'] = mixer.clipAction(domainAnimation[0], ref.current);
    actions['idle'].play();
  }, [
    actions,
    mixer,
    idleAnimation,
    walkAnimation,
    jumpAnimation,
    runAnimation,
    leftAnimation,
    rightAnimation,
    guardAnimation,
    blueAnimation,
    redAnimation,
    purpleAnimation,
    domainAnimation,
  ]);

  return (
    <group ref={ref} dispose={null}>
      <group name="Scene">
        <group name="Armature" rotation={[Math.PI / 2, 0, 0]} scale={0.01}>
          <primitive object={nodes.mixamorigHips} />
          <skinnedMesh
            castShadow
            name="Mesh"
            frustumCulled={false}
            geometry={nodes.Mesh.geometry}
            material={materials.SpacePirate_M}
            skeleton={nodes.Mesh.skeleton}
          />
        </group>
      </group>
    </group>
  );
}

useGLTF.preload([
  'https://cdn.jsdelivr.net/gh/Sean-Bradley/React-Three-Fiber-Boilerplate@followCam/public/models/eve.glb',
  'https://cdn.jsdelivr.net/gh/Sean-Bradley/React-Three-Fiber-Boilerplate@followCam/public/models/eve@jump.glb',
  idleAnim,
  walkAnim,
  runAnim,
  leftAnim,
  rightAnim,
  guardAnim,
  blueAnim,
  redAnim,
  domainAnim,
  purpleAnim,
]);
