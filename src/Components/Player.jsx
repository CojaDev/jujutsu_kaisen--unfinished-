import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Vector3, Euler, Quaternion, Matrix4 } from 'three';
import Model from './Model';
import { useCompoundBody, useContactMaterial } from '@react-three/cannon';
import useKeyboard from './UseKeyboard';
import { useSound } from 'use-sound';
import { useFrame } from '@react-three/fiber';
import { Vec3 } from 'cannon-es';
import UseFollowCam from './UseFollowCam';
import hollowSound from '../assets/sounds/hollow 2.mp3';
import redSound from '../assets/sounds/redExp.MP3';
import blueSound from '../assets/sounds/blue2.MP3';
import { useStore } from '../App';
import { ShaderMaterial } from 'three';

export default function PlayerCollider({ position }) {
  const playerGrounded = useRef(false);
  const inJumpAction = useRef(false);
  const group = useRef();
  const { yaw } = UseFollowCam(group, [0, 1, 1.5]);
  const velocity = useMemo(() => new Vector3(), []);
  const inputVelocity = useMemo(() => new Vector3(), []);
  const euler = useMemo(() => new Euler(), []);
  const quat = useMemo(() => new Quaternion(), []);
  const targetQuaternion = useMemo(() => new Quaternion(), []);
  const worldPosition = useMemo(() => new Vector3(), []);
  const raycasterOffset = useMemo(() => new Vector3(), []);
  const contactNormal = useMemo(() => new Vec3(0, 0, 0), []);
  const down = useMemo(() => new Vec3(0, -1, 0), []);
  const rotationMatrix = useMemo(() => new Matrix4(), []);
  const prevActiveAction = useRef(0); // 0:idle, 1:walking, 2:jumping
  const keyboard = useKeyboard();
  let speed = 80;
  const sprintSpeed = 80;
  let combat = false;
  const { groundObjects, actions, mixer } = useStore((state) => state);
  const [playHollowSound] = useSound(hollowSound);
  const [playRedSound] = useSound(redSound);
  const [playBlueSound] = useSound(blueSound);
  const [SoundStarted, setSoundStarted] = useState(false);
  const [StartMoving, setStartMoving] = useState(false);
  const [isRKeyPressed, setRKeyPressed] = useState(false);
  const [projectilePosition, setProjectilePosition] = useState(null);
  const [isQKeyPressed, setQKeyPressed] = useState(false);
  const [BlueProjectilePosition, setBlueProjectilePosition] = useState(null);
  const [StartMovingBlue, setStartMovingBlue] = useState(false);
  const [reversalActive, setReversalActive] = useState(false);
  const [reversalCooldown, setReversalCooldown] = useState(false);
  const [showParticles, setShowParticles] = useState(false);
  const auraRef = useRef();
  const explosionRef = useRef();
  // Create a ShaderMaterial for the reversal effect
  const reversalMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          time: { value: 1.0 },
          color: { value: new THREE.Color(1.0, 0.0, 0.0) }, // Set to red
          scaleProgress: { value: 0.0 }, // Uniform for scale animation
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 color;
          uniform float time;
          uniform float scaleProgress; // Uniform for scale animation
          varying vec2 vUv;
          void main() {
            // Scale animation
            vec3 scaledPosition = position * (1.0 + scaleProgress * 4.0);
            gl_FragColor = vec4(color, abs(sin(time * 3.0)));
            gl_FragColor.a *= 0.5; // Adjust opacity here
          }
        `,
      }),
    []
  );
  useContactMaterial('ground', 'slippery', {
    friction: 0,
    restitution: 0.01,
    contactEquationStiffness: 1e8,
    contactEquationRelaxation: 3,
  });

  const [ref, body] = useCompoundBody(
    () => ({
      mass: 1,
      shapes: [
        { args: [0.25], position: [0, 0.25, 0], type: 'Sphere' },
        { args: [0.25], position: [0, 0.75, 0], type: 'Sphere' },
        { args: [0.25], position: [0, 1.25, 0], type: 'Sphere' },
        { args: [0.4, 1.35, 0.4, 0.4], position: [0, 0.68, 0], type: 'Box' },
      ],
      onCollide: (e) => {
        if (e.contact.bi.id !== e.body.id) {
          contactNormal.set(...e.contact.ni);
        }
        if (contactNormal.dot(down) > 0.5) {
          if (inJumpAction.current) {
            inJumpAction.current = false;
            actions['jump'].fadeOut(0.1);
            actions['run'].fadeOut(0.1);
            actions['idle'].reset().fadeIn(0.1).play();
          }
        }
      },

      material: 'slippery',
      linearDamping: 0,
      position: position,
    }),
    useRef()
  );

  useFrame(({ raycaster, clock }, delta) => {
    let activeAction = 0; // 0:idle, 1:walking, 2:jumping

    body.angularFactor.set(0, 0, 0);

    ref.current.getWorldPosition(worldPosition);

    playerGrounded.current = false;
    raycasterOffset.copy(worldPosition);
    raycasterOffset.y += 0.01;
    raycaster.set(raycasterOffset, down);
    raycaster
      .intersectObjects(Object.values(groundObjects), false)
      .forEach((i) => {
        //console.log(i.distance)
        if (i.distance < 0.021) {
          playerGrounded.current = true;
        }
      });
    if (!playerGrounded.current) {
      //console.log('in air')
      body.linearDamping.set(0);
    } else {
      body.linearDamping.set(0.9999999);
    }

    const distance = worldPosition.distanceTo(group.current.position);

    rotationMatrix.lookAt(
      worldPosition,
      group.current.position,
      group.current.up
    );
    targetQuaternion.setFromRotationMatrix(rotationMatrix);
    if (
      distance > 0.0001 &&
      !group.current.quaternion.equals(targetQuaternion)
    ) {
      targetQuaternion.z = 0;
      targetQuaternion.x = 0;
      targetQuaternion.normalize();
      group.current.quaternion.rotateTowards(targetQuaternion, delta * 20);
    }
    if (document.pointerLockElement) {
      inputVelocity.set(0, 0, 0);
      console.log(speed);
      const isSprinting = keyboard['ShiftLeft'];
      speed = isSprinting ? sprintSpeed : 10;

      if (playerGrounded.current) {
        if (keyboard['KeyW']) {
          activeAction = 1;
          inputVelocity.z = -speed * delta;
          if (keyboard['ShiftLeft']) {
            activeAction = 3;
          }
        }
        if (keyboard['KeyS']) {
          activeAction = 1;
          inputVelocity.z = speed * delta;
          if (keyboard['ShiftLeft']) {
            activeAction = 3;
          }
        }
        if (keyboard['KeyA']) {
          activeAction = 1;
          inputVelocity.x = -speed * delta;
          if (keyboard['ShiftLeft']) {
            activeAction = 3;
          }
        }
        if (keyboard['KeyD']) {
          activeAction = 1;
          inputVelocity.x = speed * delta;
          if (keyboard['ShiftLeft']) {
            activeAction = 3;
          }
        }

        if (keyboard['KeyF']) {
          //domain Expansion on
          activeAction = 9;
          inputVelocity.z = 0;
          inputVelocity.x = 0;
        }
        if (keyboard['Mouse0']) {
          combat = true;
          activeAction = 7;
          inputVelocity.z = 0;
          inputVelocity.x = 0;
        }

        if (keyboard['Mouse2']) {
          combat = true;
          activeAction = 8;
          inputVelocity.z = 0;
          inputVelocity.x = 0;
        }
      }
      if (!reversalCooldown) {
        if (keyboard['KeyE']) {
          playRedSound();
          setShowParticles(false);
          setReversalCooldown(true);

          setTimeout(() => {
            setReversalActive(true);

            // Set a timeout for 1 second after reversal effect starts
            setTimeout(() => {
              setReversalActive(false);
              setShowParticles(true);

              // Set a timeout for 1 second after particles appear
              setTimeout(() => {
                setShowParticles(false);
                setReversalCooldown(false);
              }, 2000);
            }, 3000);
          }, 1600);
        }
      }

      // ... (Your existing code)
      if (reversalActive) {
        if (auraRef.current) {
          // Gradually appear and grow
          let scaleProgress = Math.min(clock.elapsedTime / 1, 1); // Adjust the duration as needed
          const scaleFactor = 1 + scaleProgress * 4; // Adjust the scale factor as needed

          auraRef.current.scale.x +=
            (scaleFactor - auraRef.current.scale.x) * 0.005;
          auraRef.current.scale.y +=
            (scaleFactor - auraRef.current.scale.y) * 0.005;
          auraRef.current.scale.z +=
            (scaleFactor - auraRef.current.scale.z) * 0.005;

          // Trigger explosion effect
          if (scaleProgress === 1 && !explosionRef.current) {
            explosionRef.current = true;

            // Add your explosion effect here, e.g., change material or create particles
            auraRef.current.material = new THREE.MeshBasicMaterial({
              color: 0xff0000,
              transparent: true,
              opacity: 0.5,
              alphaTest: 0.5,
            });
            auraRef.current.material.renderOrder = -1;

            // Create particles or any other explosion effect
            // For simplicity, I'm creating a particle system using CustomGeometryParticles
            const explosionParticles = (
              <mesh position={[0, 1, 0.7]}>
                <CustomGeometryParticles count={3000} color={'#ff0000'} />
              </mesh>
            );

            // Add the explosion particles to the scene
            auraRef.current.add(explosionParticles);
          }
        }
      } else {
        // Reset the explosion flag if reversal is not active
        explosionRef.current = false;
      }
      if (keyboard['KeyQ'] && !isQKeyPressed) {
        setQKeyPressed(true);
        setStartMovingBlue(false);
        playBlueSound();
        const BlueForwardVector = new Vector3(0, 2, -1);
        BlueForwardVector.applyQuaternion(group.current.quaternion);

        // Calculate circular motion around the player
        const radius = 1.3; // You can adjust the radius as needed
        const angle = clock.elapsedTime * 2; // Adjust speed by changing the multiplier
        const circularMotion = new Vector3(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        );
        const offset = circularMotion;
        const newProjectilePosition = worldPosition.clone().add(offset);
        newProjectilePosition.y = 3;

        // Set the new position for the projectile
        setBlueProjectilePosition(newProjectilePosition);

        setTimeout(() => {
          setQKeyPressed(false);
          setBlueProjectilePosition(null);
        }, 18000);

        combat = true;
        activeAction = 4;
        actions['purple'].reset().fadeIn(0.1).play();
        actions['purple'].setLoop(THREE.LoopOnce, 1);
        setStartMovingBlue(true);

        inputVelocity.z = 0;
        inputVelocity.x = 0;
      }
      const BlueForwardVector = new Vector3(0, 0, -1);
      BlueForwardVector.applyQuaternion(group.current.quaternion);
      // Check if the projectile is active (position is not null)
      if (BlueProjectilePosition !== null && StartMovingBlue === true) {
        // Update the position in a circular motion around the player
        const radius = 1.3; // Same radius as above
        const angle = clock.elapsedTime * 2; // Same multiplier as above
        const circularMotion = new Vector3(
          Math.cos(angle) * radius,
          0,
          Math.sin(angle) * radius
        );

        const newProjectilePosition = worldPosition.clone().add(circularMotion);
        newProjectilePosition.y = 1;
        // Update the state with the new position
        setBlueProjectilePosition(newProjectilePosition);
      }

      if (keyboard['KeyR'] && !isRKeyPressed) {
        setRKeyPressed(true);
        setStartMoving(false);

        // Calculate the forward direction from the player's orientation
        const forwardVector = new Vector3(0, 0, 0.5);
        forwardVector.applyQuaternion(group.current.quaternion);

        // Set the position of the projectile in front of the player at height 2s
        const offset = forwardVector.clone().multiplyScalar(2);
        const newProjectilePosition = worldPosition.clone().add(offset);
        newProjectilePosition.y = 1;

        // Set the new position for the projectile
        setProjectilePosition(newProjectilePosition);

        setTimeout(() => {
          setRKeyPressed(false);
          setProjectilePosition(null);
        }, 12000);

        combat = true;
        activeAction = 6;
        actions['purple'].reset().fadeIn(0.1).play();
        actions['purple'].setLoop(THREE.LoopOnce, 1);

        if (SoundStarted === false) {
          setSoundStarted(true);

          setTimeout(() => {
            playHollowSound();
            setTimeout(() => {
              setStartMoving(true);
            }, 2500);

            setTimeout(() => {
              setSoundStarted(false);
            }, 6000);
          }, 1200);
        }

        inputVelocity.z = 0;
        inputVelocity.x = 0;
      }
      const forwardVector = new Vector3(0, 0, -1);
      forwardVector.applyQuaternion(group.current.quaternion);
      // Check if the projectile is active (position is not null)
      if (projectilePosition !== null && StartMoving === true) {
        // Update the position by moving 30 units on the Z-axis (change this value as needed)

        const newProjectilePosition = projectilePosition.clone();
        newProjectilePosition.add(
          forwardVector.clone().multiplyScalar(-30 * delta)
        );

        // Update the state with the new position
        setProjectilePosition(newProjectilePosition);
      }
      if (isSprinting) {
        inputVelocity.setLength(1);
      } else {
        inputVelocity.setLength(0.3);
      }
      if (activeAction !== prevActiveAction.current) {
        //console.log('active action changed')
        if (prevActiveAction.current !== 1 && activeAction === 1) {
          //console.log('idle --> walking')
          actions['idle'].fadeOut(0.1);
          actions['run'].fadeOut(0.1);
          actions['red'].fadeOut(0.1);
          actions['blue'].fadeOut(0.1);
          actions['purple'].fadeOut(0.1);
          actions['left'].fadeOut(0.1);
          actions['domain'].fadeOut(0.1);
          actions['right'].fadeOut(0.1);
          actions['walk'].reset().fadeIn(0.1).play();
        }
        if (prevActiveAction.current !== 3 && activeAction === 3) {
          //console.log('idle --> walking')
          actions['idle'].fadeOut(0.1);
          actions['walk'].fadeOut(0.1);
          actions['red'].fadeOut(0.1);
          actions['blue'].fadeOut(0.1);
          actions['purple'].fadeOut(0.1);
          actions['left'].fadeOut(0.1);
          actions['domain'].fadeOut(0.1);
          actions['right'].fadeOut(0.1);
          actions['run'].reset().fadeIn(0.1).play();
        }
        if (prevActiveAction.current !== 4 && activeAction === 4) {
          //console.log('idle --> walking')
          actions['idle'].fadeOut(0.1);
          actions['walk'].fadeOut(0.1);
          actions['run'].fadeOut(0.1);
          actions['purple'].fadeOut(0.1);
          actions['left'].fadeOut(0.1);
          actions['right'].fadeOut(0.1);
          actions['domain'].fadeOut(0.1);
          actions['blue'].fadeOut(0.1);
          actions['red'].reset().fadeIn(0.2).play();
        }
        if (prevActiveAction.current !== 5 && activeAction === 5) {
          actions['idle'].fadeOut(0.1);
          actions['walk'].fadeOut(0.1);
          actions['run'].fadeOut(0.1);
          actions['red'].fadeOut(0.1);
          actions['purple'].fadeOut(0.1);
          actions['left'].fadeOut(0.1);
          actions['domain'].fadeOut(0.1);
          actions['right'].fadeOut(0.1);
          actions['blue'].reset().fadeIn(0.2).play();
        }
        if (prevActiveAction.current !== 6 && activeAction === 6) {
          actions['idle'].fadeOut(0.1);
          actions['walk'].fadeOut(0.1);
          actions['run'].fadeOut(0.1);
          actions['red'].fadeOut(0.1);
          actions['blue'].fadeOut(0.1);
          actions['left'].fadeOut(0.1);
          actions['domain'].fadeOut(0.1);
          actions['right'].fadeOut(0.1);
        }
        if (prevActiveAction.current !== 7 && activeAction === 7) {
          actions['idle'].fadeOut(0.1);
          actions['walk'].fadeOut(0.1);
          actions['run'].fadeOut(0.1);
          actions['red'].fadeOut(0.1);
          actions['blue'].fadeOut(0.1);
          actions['right'].fadeOut(0.4);
          actions['domain'].fadeOut(0.1);

          actions['left'].reset().fadeIn(0.1).play();
        }
        if (prevActiveAction.current !== 8 && activeAction === 8) {
          actions['idle'].fadeOut(0.1);
          actions['walk'].fadeOut(0.1);
          actions['run'].fadeOut(0.1);
          actions['red'].fadeOut(0.1);
          actions['blue'].fadeOut(0.1);
          actions['left'].fadeOut(0.4);
          actions['domain'].fadeOut(0.1);
          // actions['right'].setLoop(THREE.LoopOnce, 1);
          actions['right'].reset().fadeIn(0.1).play();
        }
        if (prevActiveAction.current !== 9 && activeAction === 9) {
          actions['idle'].fadeOut(0.1);
          actions['walk'].fadeOut(0.1);
          actions['run'].fadeOut(0.1);
          actions['red'].fadeOut(0.1);
          actions['blue'].fadeOut(0.1);
          actions['left'].fadeOut(0.1);
          actions['right'].fadeOut(0.1);
          actions['domain'].reset().fadeIn(0.5).play();
        }
        if (prevActiveAction.current !== 0 && activeAction === 0) {
          actions['walk'].fadeOut(0.1);
          actions['run'].fadeOut(0.1);
          actions['red'].fadeOut(0.1);
          actions['blue'].fadeOut(0.1);
          actions['purple'].fadeOut(0.1);
          actions['left'].fadeOut(0.1);
          actions['right'].fadeOut(0.1);
          actions['domain'].fadeOut(1);

          actions['idle'].reset().fadeIn(0.1).play();
        }
        prevActiveAction.current = activeAction;
      }

      if (keyboard['Space']) {
        if (playerGrounded.current && !inJumpAction.current) {
          console.log('jump');
          activeAction = 2;
          inJumpAction.current = true;
          actions['walk'].fadeOut(0.1);
          actions['idle'].fadeOut(0.1);
          actions['run'].fadeOut(0.1);
          actions['purple'].fadeOut(0.1);
          actions['left'].fadeOut(0.1);
          actions['right'].fadeOut(0.1);
          actions['domain'].fadeOut(0.1);
          actions['jump'].reset().fadeIn(0.1).play();
          inputVelocity.y = 6;
        }
      }

      euler.y = yaw.rotation.y;
      quat.setFromEuler(euler);
      inputVelocity.applyQuaternion(quat);
      velocity.set(inputVelocity.x, inputVelocity.y, inputVelocity.z);

      body.applyImpulse([velocity.x, velocity.y, velocity.z], [0, 0, 0]);
    }

    if (activeAction === 1) {
      mixer.update(delta * distance * 22.5);
    } else {
      mixer.update(delta);
    }

    group.current.position.lerp(worldPosition, 0.3);
  });

  const CustomGeometryParticles = (props) => {
    const { count, color, min = 1, max = 0.5, time = 6 } = props;
    const scaleRef = useRef(min);

    // This reference gives us direct access to our points
    const points = useRef();

    // Generate our positions attributes array
    const particlesPosition = useMemo(() => {
      const positions = new Float32Array(count * 7);
      const distance = 0.4;

      for (let i = 0; i < count; i++) {
        const theta = THREE.MathUtils.randFloatSpread(360);
        const phi = THREE.MathUtils.randFloatSpread(360);

        let x = distance * Math.sin(theta) * Math.cos(phi);
        let y = distance * Math.sin(theta) * Math.sin(phi);
        let z = distance * Math.cos(theta);

        positions.set([x, y, z], i * 3);
      }

      return positions;
    }, [count]);

    useFrame((state) => {
      const { clock } = state;

      const duration = time; // Adjust the duration for the entire growth/shrink cycle

      // Calculate a progress value between 0 and 1 based on elapsed time and duration
      const progress = (clock.elapsedTime % duration) / duration;

      // Use a smooth function to control the scaling progress
      const scaleProgress = 1 - Math.abs(Math.sin(progress * Math.PI));

      // Update the scale based on the progress
      scaleRef.current = min + scaleProgress * max; // Adjust the multiplier for the maximum scale

      points.current.scale.set(
        scaleRef.current,
        scaleRef.current,
        scaleRef.current
      );
      points.current.geometry.attributes.position.needsUpdate = true;
    });

    return (
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particlesPosition.length / 3}
            array={particlesPosition}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          renderOrder={1}
          size={0.018}
          color={color}
          alphaTest={0.2}
          depthWrite={true}
        />
      </points>
    );
  };

  return (
    <>
      <group ref={group} position={position}>
        <Suspense fallback={null}>
          <Model />
          <group>
            {reversalActive && (
              <mesh ref={auraRef} position={[0, 1, 0.7]}>
                <sphereGeometry args={[0.1, 42, 42]} />
                <meshBasicMaterial
                  color={'#ff0000'}
                  transparent
                  opacity={0.5}
                />
              </mesh>
            )}
            {showParticles && (
              <mesh position={[0, 1, 0.7]}>
                <CustomGeometryParticles
                  count={1000}
                  color={'tomato'}
                  min={0.1}
                  time={9}
                  max={5.9}
                />
              </mesh>
            )}
          </group>
        </Suspense>
      </group>
      {isRKeyPressed && projectilePosition && (
        <mesh position={projectilePosition}>
          <CustomGeometryParticles
            count={1000}
            color={'#c673fa'}
            max={0.2}
            min={1.1}
          />
          <sphereGeometry args={[0.38, 32, 32]} />
          <meshStandardMaterial color={'#a50fdb'} />
        </mesh>
      )}
      {isQKeyPressed && BlueProjectilePosition && (
        <mesh position={BlueProjectilePosition}>
          <CustomGeometryParticles count={1000} color={'#719bf5'} />
          <sphereGeometry args={[0.38, 32, 32]} />

          <meshStandardMaterial color={'#4c84fc'} />
        </mesh>
      )}
    </>
  );
}
