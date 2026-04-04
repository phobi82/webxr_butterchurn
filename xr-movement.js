// Collision world and locomotion.

// Collision
const createCollisionWorld = function(options) {
	const staticBoxes = options.staticBoxes || [];
	const dynamicBoxSources = options.dynamicBoxSources || [];
	const floorHalfSize = options.floorHalfSize || 0;
	const playerRadius = options.playerRadius || 0.32;
	const stepHeight = options.stepHeight || 0.5;

	// Reusable array to avoid per-call allocation of combined box list
	let combinedBoxes = [];
	const getBoxes = function() {
		let count = staticBoxes.length;
		for (let i = 0; i < dynamicBoxSources.length; i += 1) {
			const sourceBoxes = dynamicBoxSources[i]() || [];
			for (let j = 0; j < sourceBoxes.length; j += 1) {
				combinedBoxes[count] = sourceBoxes[j];
				count += 1;
			}
		}
		for (let i = 0; i < staticBoxes.length; i += 1) {
			combinedBoxes[i] = staticBoxes[i];
		}
		combinedBoxes.length = count;
		return combinedBoxes;
	};

	const getBoxBounds = function(box) {
		return {
			minX: box.x - box.width * 0.5,
			maxX: box.x + box.width * 0.5,
			minY: box.y - box.height * 0.5,
			maxY: box.y + box.height * 0.5,
			minZ: box.z - box.depth * 0.5,
			maxZ: box.z + box.depth * 0.5
		};
	};

	const rangesOverlap = function(minA, maxA, minB, maxB) {
		return maxA > minB && minA < maxB;
	};

	const getMaxClimbSurfaceY = function(currentY, eyeHeightMeters) {
		return currentY + Math.max(stepHeight, eyeHeightMeters - 0.5);
	};

	const getFloorHeightAtPosition = function(x, z, maxY) {
		let surfaceY = Math.abs(x) <= floorHalfSize && Math.abs(z) <= floorHalfSize && 0 <= maxY ? 0 : -Infinity;
		const boxes = getBoxes();
		for (let i = 0; i < boxes.length; i += 1) {
			const bounds = getBoxBounds(boxes[i]);
			if (
				bounds.maxY <= maxY &&
				x >= bounds.minX - playerRadius &&
				x <= bounds.maxX + playerRadius &&
				z >= bounds.minZ - playerRadius &&
				z <= bounds.maxZ + playerRadius
			) {
				surfaceY = Math.max(surfaceY, bounds.maxY);
			}
		}
		return surfaceY;
	};

	const resolveHorizontalMovement = function(args) {
		const currentX = args.currentX;
		const currentY = args.currentY;
		const currentZ = args.currentZ;
		const nextX = args.nextX;
		const nextZ = args.nextZ;
		const playerHeight = args.playerHeight;
		const eyeHeightMeters = args.eyeHeightMeters;
		const momentumState = args.momentumState || null;
		const bodyMinY = currentY + 0.02;
		const bodyMaxY = currentY + playerHeight;
		const currentSurfaceY = getFloorHeightAtPosition(currentX, currentZ, currentY + 0.05);
		const maxClimbSurfaceY = getMaxClimbSurfaceY(currentY, eyeHeightMeters);
		const boxes = getBoxes();
		const canOccupyPosition = function(testX, testZ) {
			const testSurfaceY = getFloorHeightAtPosition(testX, testZ, maxClimbSurfaceY);
			let targetY = currentY;
			for (let i = 0; i < boxes.length; i += 1) {
				const bounds = getBoxBounds(boxes[i]);
				if (!rangesOverlap(bodyMinY, bodyMaxY, bounds.minY, bounds.maxY)) {
					continue;
				}
				if (
					testSurfaceY > currentSurfaceY + 0.001 &&
					testSurfaceY <= maxClimbSurfaceY &&
					testX >= bounds.minX - playerRadius &&
					testX <= bounds.maxX + playerRadius &&
					testZ >= bounds.minZ - playerRadius &&
					testZ <= bounds.maxZ + playerRadius
				) {
					targetY = Math.max(targetY, testSurfaceY);
					continue;
				}
				if (
					testX >= bounds.minX - playerRadius &&
					testX <= bounds.maxX + playerRadius &&
					testZ >= bounds.minZ - playerRadius &&
					testZ <= bounds.maxZ + playerRadius
				) {
					return null;
				}
			}
			return {x: testX, y: targetY, z: testZ};
		};
		const fullStep = canOccupyPosition(nextX, nextZ);
		if (fullStep) {
			return fullStep;
		}
		const xOnlyStep = canOccupyPosition(nextX, currentZ);
		if (xOnlyStep) {
			if (momentumState) {
				momentumState.z = 0;
			}
			return xOnlyStep;
		}
		const zOnlyStep = canOccupyPosition(currentX, nextZ);
		if (zOnlyStep) {
			if (momentumState) {
				momentumState.x = 0;
			}
			return zOnlyStep;
		}
		if (momentumState) {
			momentumState.x = 0;
			momentumState.z = 0;
		}
		return {x: currentX, y: currentY, z: currentZ};
	};

	const resolveVerticalMovement = function(args) {
		const previousY = args.previousY;
		let resolvedY = args.nextY;
		const x = args.x;
		const z = args.z;
		const playerHeight = args.playerHeight;
		const eyeHeightMeters = args.eyeHeightMeters;
		const verticalVelocity = args.verticalVelocity;
		let groundedBool = false;
		let hitCeilingBool = false;
		let supportingSurfaceY = getFloorHeightAtPosition(x, z, getMaxClimbSurfaceY(Math.max(previousY, resolvedY), eyeHeightMeters));
		const boxes = getBoxes();
		for (let i = 0; i < boxes.length; i += 1) {
			const bounds = getBoxBounds(boxes[i]);
			if (
				x < bounds.minX - playerRadius ||
				x > bounds.maxX + playerRadius ||
				z < bounds.minZ - playerRadius ||
				z > bounds.maxZ + playerRadius
			) {
				continue;
			}
			if (verticalVelocity <= 0 && previousY >= bounds.maxY && resolvedY <= bounds.maxY) {
				resolvedY = bounds.maxY;
				groundedBool = true;
				supportingSurfaceY = Math.max(supportingSurfaceY, bounds.maxY);
			}
			if (verticalVelocity > 0) {
				const currentHeadY = previousY + playerHeight;
				const nextHeadY = resolvedY + playerHeight;
				if (currentHeadY <= bounds.minY && nextHeadY >= bounds.minY) {
					resolvedY = Math.min(resolvedY, bounds.minY - playerHeight);
					hitCeilingBool = true;
				}
			}
		}
		if (supportingSurfaceY > -Infinity && verticalVelocity <= 0 && resolvedY <= supportingSurfaceY) {
			resolvedY = supportingSurfaceY;
			groundedBool = true;
		}
		return {
			y: resolvedY,
			groundedBool: groundedBool,
			hitCeilingBool: hitCeilingBool
		};
	};

	return {
		getBoxes: getBoxes,
		getFloorHeightAtPosition: getFloorHeightAtPosition,
		getMaxClimbSurfaceY: getMaxClimbSurfaceY,
		resolveHorizontalMovement: resolveHorizontalMovement,
		resolveVerticalMovement: resolveVerticalMovement
	};
};

// Locomotion
const normalize2d = function(x, y) {
	const length = Math.sqrt(x * x + y * y) || 1;
	return {x: x / length, y: y / length};
};

const getHeadYaw = function(orientation) {
	return Math.atan2(
		2 * (orientation.w * orientation.y + orientation.x * orientation.z),
		1 - 2 * (orientation.y * orientation.y + orientation.z * orientation.z)
	);
};

const applyJumpInput = function(options, state, jumpHeldBool, jumpMode, delta) {
	if (jumpHeldBool && !state.jumpPressedBool && (jumpMode === "multi" || state.jumpCount < options.doubleJumpMaxCount)) {
		state.jumpVelocity = options.jumpSpeed;
		state.jumpHoldTimeSeconds = options.jumpHoldMaxSeconds;
		if (jumpMode === "double") {
			state.jumpCount += 1;
		}
	}
	if (jumpHeldBool && state.jumpVelocity > 0 && state.jumpHoldTimeSeconds > 0) {
		state.jumpVelocity += options.jumpHoldBoostSpeed * delta;
		state.jumpHoldTimeSeconds = Math.max(0, state.jumpHoldTimeSeconds - delta);
	}
	if (!jumpHeldBool) {
		state.jumpHoldTimeSeconds = 0;
	}
	state.jumpPressedBool = jumpHeldBool;
};

const applyGravityAndVertical = function(options, world, state, delta, playerHeight, eyeHeight) {
	const playerPosition = state.playerPosition || state.origin;
	const supportHeight = world.getFloorHeightAtPosition(
		playerPosition.x,
		playerPosition.z,
		world.getMaxClimbSurfaceY(Math.max(playerPosition.y, playerPosition.y + state.jumpVelocity * delta), eyeHeight)
	);
	if (state.jumpVelocity === 0 && playerPosition.y <= supportHeight && supportHeight !== -Infinity) {
		return {airborneBool: false, groundedBool: false, fallResetBool: false};
	}
	const previousY = playerPosition.y;
	state.jumpVelocity += options.jumpGravity * delta;
	playerPosition.y += state.jumpVelocity * delta;
	const resolvedVertical = world.resolveVerticalMovement({
		previousY: previousY,
		nextY: playerPosition.y,
		x: playerPosition.x,
		z: playerPosition.z,
		playerHeight: playerHeight,
		eyeHeightMeters: eyeHeight,
		verticalVelocity: state.jumpVelocity
	});
	playerPosition.y = resolvedVertical.y;
	if (resolvedVertical.hitCeilingBool && state.jumpVelocity > 0) {
		state.jumpVelocity = 0;
		state.jumpHoldTimeSeconds = 0;
	}
	if (playerPosition.y <= options.fallResetY) {
		return {airborneBool: true, groundedBool: false, fallResetBool: true};
	}
	if (resolvedVertical.groundedBool) {
		state.jumpVelocity = 0;
		state.jumpHoldTimeSeconds = 0;
		state.jumpCount = 0;
		return {airborneBool: false, groundedBool: true, fallResetBool: false};
	}
	return {airborneBool: true, groundedBool: false, fallResetBool: false};
};

const createXrLocomotionState = function(options) {
	return {
		playerPosition: {x: 0, y: 0, z: 0},
		headPosition: {x: 0, y: options.defaultEyeHeight, z: 0},
		heading: 0,
		jumpVelocity: 0,
		horizontalVelocityX: 0,
		horizontalVelocityZ: 0,
		jumpCount: 0,
		jumpPressedBool: false,
		jumpHoldTimeSeconds: 0
	};
};

const createDesktopLocomotionState = function(options) {
	return {
		origin: {x: 0, y: 0, z: options.desktopStartZ},
		lookYaw: 0,
		lookPitch: options.desktopStartPitch,
		jumpVelocity: 0,
		jumpCount: 0,
		jumpPressedBool: false,
		jumpHoldTimeSeconds: 0,
		eyeHeightMeters: options.defaultEyeHeight,
		jumpHeldBool: false,
		moveForwardBool: false,
		moveBackwardBool: false,
		moveLeftBool: false,
		moveRightBool: false,
		sprintBool: false,
		crouchBool: false
	};
};

const resetXrLocomotionState = function(options, state) {
	state.playerPosition.x = 0;
	state.playerPosition.y = 0;
	state.playerPosition.z = 0;
	state.headPosition.x = 0;
	state.headPosition.y = options.defaultEyeHeight;
	state.headPosition.z = 0;
	state.heading = 0;
	state.jumpVelocity = 0;
	state.horizontalVelocityX = 0;
	state.horizontalVelocityZ = 0;
	state.jumpCount = 0;
	state.jumpPressedBool = false;
	state.jumpHoldTimeSeconds = 0;
};

const resetDesktopLocomotionState = function(options, state) {
	state.origin.x = 0;
	state.origin.y = 0;
	state.origin.z = options.desktopStartZ;
	state.lookYaw = 0;
	state.lookPitch = options.desktopStartPitch;
	state.jumpVelocity = 0;
	state.jumpCount = 0;
	state.jumpPressedBool = false;
	state.jumpHoldTimeSeconds = 0;
	state.eyeHeightMeters = options.defaultEyeHeight;
	state.jumpHeldBool = false;
	state.moveForwardBool = false;
	state.moveBackwardBool = false;
	state.moveLeftBool = false;
	state.moveRightBool = false;
	state.sprintBool = false;
	state.crouchBool = false;
};

const getGroundSupportState = function(world, x, y, z, eyeHeightMeters, jumpVelocity) {
	const floorHeight = world.getFloorHeightAtPosition(x, z, world.getMaxClimbSurfaceY(y, eyeHeightMeters));
	return {
		floorHeight: floorHeight,
		groundedBool: floorHeight > -Infinity && y <= floorHeight + 0.001 && jumpVelocity <= 0
	};
};

const applyGroundSnap = function(options, currentY, targetFloorHeight, delta) {
	return targetFloorHeight > currentY ? Math.min(targetFloorHeight, currentY + options.climbSpeed * delta) : targetFloorHeight;
};

const getDesktopMoveInput = function(state) {
	let moveX = 0;
	let moveY = 0;
	if (state.moveLeftBool) { moveX -= 1; }
	if (state.moveRightBool) { moveX += 1; }
	if (state.moveForwardBool) { moveY -= 1; }
	if (state.moveBackwardBool) { moveY += 1; }
	return {x: moveX, y: moveY};
};

const applyDesktopEyeHeight = function(options, state, delta) {
	const targetEyeHeightMeters = state.crouchBool ? options.crouchMinEyeHeight : options.defaultEyeHeight;
	if (state.eyeHeightMeters < targetEyeHeightMeters) {
		state.eyeHeightMeters = Math.min(targetEyeHeightMeters, state.eyeHeightMeters + options.crouchSpeed * delta);
	} else if (state.eyeHeightMeters > targetEyeHeightMeters) {
		state.eyeHeightMeters = Math.max(targetEyeHeightMeters, state.eyeHeightMeters - options.crouchSpeed * delta);
	}
};

const applyDesktopHorizontalMovement = function(options, world, state, delta, playerHeight, moveInput) {
	if (moveInput.x === 0 && moveInput.y === 0) {
		return false;
	}
	const moveVector = normalize2d(moveInput.x, moveInput.y);
	const movementSpeed = options.walkSpeed * (state.sprintBool ? options.sprintMultiplier : 1);
	const moveStep = world.resolveHorizontalMovement({
		currentX: state.origin.x,
		currentY: state.origin.y,
		currentZ: state.origin.z,
		nextX: state.origin.x + ((-moveVector.y) * Math.sin(state.lookYaw) + moveVector.x * Math.cos(state.lookYaw)) * movementSpeed * delta,
		nextZ: state.origin.z + (moveVector.y * Math.cos(state.lookYaw) + moveVector.x * Math.sin(state.lookYaw)) * movementSpeed * delta,
		playerHeight: playerHeight,
		eyeHeightMeters: state.eyeHeightMeters,
		momentumState: null
	});
	state.origin.x = moveStep.x;
	state.origin.y = moveStep.y > state.origin.y ? Math.min(moveStep.y, state.origin.y + options.climbSpeed * delta) : moveStep.y;
	state.origin.z = moveStep.z;
	return true;
};

const dampXrHorizontalVelocity = function(options, state, delta, groundedBool) {
	const drag = groundedBool ? options.groundMomentumDrag : options.airMomentumDrag;
	const dragFactor = Math.max(0, 1 - drag * delta);
	state.horizontalVelocityX *= dragFactor;
	state.horizontalVelocityZ *= dragFactor;
	if (Math.abs(state.horizontalVelocityX) < 0.0001) {
		state.horizontalVelocityX = 0;
	}
	if (Math.abs(state.horizontalVelocityZ) < 0.0001) {
		state.horizontalVelocityZ = 0;
	}
};

const applyXrAirBoost = function(options, state, args, groundedBool) {
	if (args.menuConsumesRightTriggerBool || !args.locomotion.airBoostActiveBool || groundedBool || !args.locomotion.rightControllerBoostDir) {
		return;
	}
	state.horizontalVelocityX += args.locomotion.rightControllerBoostDir.x * options.airBoostSpeed * args.delta;
	state.horizontalVelocityZ += args.locomotion.rightControllerBoostDir.z * options.airBoostSpeed * args.delta;
	state.jumpVelocity += args.locomotion.rightControllerBoostDir.y * options.airBoostSpeed * args.delta;
};

const applyXrHorizontalMomentum = function(options, world, state, delta, playerHeight, headHeight) {
	const playerPosition = state.playerPosition;
	const horizontalSpeed = Math.sqrt(state.horizontalVelocityX * state.horizontalVelocityX + state.horizontalVelocityZ * state.horizontalVelocityZ);
	if (horizontalSpeed <= 0.0001) {
		state.horizontalVelocityX = 0;
		state.horizontalVelocityZ = 0;
		return 0;
	}
	const momentumState = {x: state.horizontalVelocityX, z: state.horizontalVelocityZ};
	const resolvedMomentum = world.resolveHorizontalMovement({
		currentX: playerPosition.x,
		currentY: playerPosition.y,
		currentZ: playerPosition.z,
		nextX: playerPosition.x + momentumState.x * delta,
		nextZ: playerPosition.z + momentumState.z * delta,
		playerHeight: playerHeight,
		eyeHeightMeters: headHeight,
		momentumState: momentumState
	});
	playerPosition.x = resolvedMomentum.x;
	playerPosition.y = resolvedMomentum.y > playerPosition.y ? Math.min(resolvedMomentum.y, playerPosition.y + options.climbSpeed * delta) : resolvedMomentum.y;
	playerPosition.z = resolvedMomentum.z;
	state.horizontalVelocityX = momentumState.x;
	state.horizontalVelocityZ = momentumState.z;
	return horizontalSpeed;
};

const createLocomotion = function(options) {
	const world = options.world;

	const syncHeadPositionFromRenderPose = function(state, renderedTransform) {
		if (!renderedTransform || !renderedTransform.position) {
			return false;
		}
		const previousHeadX = state.headPosition.x;
		const previousHeadY = state.headPosition.y;
		const previousHeadZ = state.headPosition.z;
		const headWorldOffset = {
			x: renderedTransform.position.x - state.playerPosition.x,
			y: renderedTransform.position.y - state.playerPosition.y,
			z: renderedTransform.position.z - state.playerPosition.z
		};
		const headLocalOffset = rotateXZ(headWorldOffset.x, headWorldOffset.z, -state.heading);
		state.headPosition.x = headLocalOffset.x;
		state.headPosition.y = headWorldOffset.y;
		state.headPosition.z = headLocalOffset.z;
		return (
			Math.abs(state.headPosition.x - previousHeadX) > 0.0001 ||
			Math.abs(state.headPosition.y - previousHeadY) > 0.0001 ||
			Math.abs(state.headPosition.z - previousHeadZ) > 0.0001
		);
	};

	const getHeadWorldOffset = function(state) {
		const horizontalOffset = rotateXZ(state.headPosition.x, state.headPosition.z, state.heading);
		return {
			x: horizontalOffset.x,
			y: state.headPosition.y,
			z: horizontalOffset.z
		};
	};

	const updateHeadPositionFromInput = function(state, delta, stanceInputY) {
		const previousHeadY = state.headPosition.y;
		if (stanceInputY !== 0) {
			state.headPosition.y += stanceInputY * options.crouchSpeed * delta;
		} else if (state.headPosition.y > options.defaultEyeHeight) {
			state.headPosition.y = Math.max(options.defaultEyeHeight, state.headPosition.y - options.crouchSpeed * delta);
		}
		// Clamp the combined head result directly because only player and head positions exist.
		state.headPosition.y = clampNumber(state.headPosition.y, options.crouchMinEyeHeight, options.defaultEyeHeight + options.tiptoeEyeHeightBoost);
		return Math.abs(state.headPosition.y - previousHeadY) > 0.0001;
	};

	const applyWalkingMovement = function(state, delta, moveX, moveY, worldYaw, playerHeight, headHeight, sprintActiveBool) {
		if (moveX === 0 && moveY === 0) {
			return false;
		}
		const playerPosition = state.playerPosition || state.origin;
		const moveVector = normalize2d(moveX, moveY);
		const cosYaw = Math.cos(worldYaw);
		const sinYaw = Math.sin(worldYaw);
		const movementSpeed = options.walkSpeed * (sprintActiveBool ? options.sprintMultiplier : 1);
		const moveStep = world.resolveHorizontalMovement({
			currentX: playerPosition.x,
			currentY: playerPosition.y,
			currentZ: playerPosition.z,
			nextX: playerPosition.x + (moveVector.y * sinYaw + moveVector.x * cosYaw) * movementSpeed * delta,
			nextZ: playerPosition.z + (moveVector.y * cosYaw - moveVector.x * sinYaw) * movementSpeed * delta,
			playerHeight: playerHeight,
			eyeHeightMeters: headHeight,
			momentumState: null
		});
		playerPosition.x = moveStep.x;
		playerPosition.y = moveStep.y > playerPosition.y ? Math.min(moveStep.y, playerPosition.y + options.climbSpeed * delta) : moveStep.y;
		playerPosition.z = moveStep.z;
		return true;
	};

	const applyXrMoveInputVelocity = function(state, delta, moveX, moveY, worldYaw, sprintActiveBool, groundedBool) {
		if (moveX === 0 && moveY === 0) {
			return;
		}
		// XR movement steers the shared horizontal velocity instead of moving the player directly.
		const moveStrength = Math.min(1, Math.sqrt(moveX * moveX + moveY * moveY));
		const moveVector = normalize2d(moveX, moveY);
		const cosYaw = Math.cos(worldYaw);
		const sinYaw = Math.sin(worldYaw);
		const movementSpeed = options.walkSpeed * (sprintActiveBool ? options.sprintMultiplier : 1) * moveStrength;
		const targetVelocityX = (moveVector.y * sinYaw + moveVector.x * cosYaw) * movementSpeed;
		const targetVelocityZ = (moveVector.y * cosYaw - moveVector.x * sinYaw) * movementSpeed;
		const velocityDeltaX = targetVelocityX - state.horizontalVelocityX;
		const velocityDeltaZ = targetVelocityZ - state.horizontalVelocityZ;
		const velocityDeltaLength = Math.sqrt(velocityDeltaX * velocityDeltaX + velocityDeltaZ * velocityDeltaZ);
		const maxVelocityChange = (groundedBool ? options.xrGroundAcceleration : options.xrAirAcceleration) * delta;
		if (velocityDeltaLength <= maxVelocityChange || velocityDeltaLength === 0) {
			state.horizontalVelocityX = targetVelocityX;
			state.horizontalVelocityZ = targetVelocityZ;
			return;
		}
		const velocityDeltaScale = maxVelocityChange / velocityDeltaLength;
		state.horizontalVelocityX += velocityDeltaX * velocityDeltaScale;
		state.horizontalVelocityZ += velocityDeltaZ * velocityDeltaScale;
	};

	return {
		createXrState: function() {
			return createXrLocomotionState(options);
		},
		createDesktopState: function() {
			return createDesktopLocomotionState(options);
		},
		resetXrState: function(state) {
			resetXrLocomotionState(options, state);
		},
		resetDesktopState: function(state) {
			resetDesktopLocomotionState(options, state);
		},
		getHeadWorldPosition: function(state) {
			const headWorldOffset = getHeadWorldOffset(state);
			return {
				x: state.playerPosition.x + headWorldOffset.x,
				y: state.playerPosition.y + headWorldOffset.y,
				z: state.playerPosition.z + headWorldOffset.z
			};
		},
		getPlayerHeight: function(state) {
			return state.headPosition.y + options.playerHeadClearance;
		},
		applyDesktopPreviewMovement: function(state, delta, jumpMode) {
			const playerHeight = state.eyeHeightMeters + options.playerHeadClearance;
			const moveInput = getDesktopMoveInput(state);
			applyDesktopEyeHeight(options, state, delta);
			applyDesktopHorizontalMovement(options, world, state, delta, playerHeight, moveInput);
			const supportState = getGroundSupportState(world, state.origin.x, state.origin.y, state.origin.z, state.eyeHeightMeters, state.jumpVelocity);
			if (supportState.groundedBool) {
				state.origin.y = applyGroundSnap(options, state.origin.y, supportState.floorHeight, delta);
				state.jumpCount = 0;
			}
			applyJumpInput(options, state, state.jumpHeldBool, jumpMode, delta);
			const verticalResult = applyGravityAndVertical(options, world, state, delta, playerHeight, state.eyeHeightMeters);
			if (verticalResult.fallResetBool) {
				resetDesktopLocomotionState(options, state);
				return {resetBool: true};
			}
			return {resetBool: false};
		},
		applyXrLocomotion: function(state, args) {
			const playerPosition = state.playerPosition;
			let referenceSpaceUpdateNeededBool = !args.renderSpaceInitializedBool;
			const renderHeadMovedBool = args.renderSpaceInitializedBool ? syncHeadPositionFromRenderPose(state, args.renderedTransform) : false;
			if (args.locomotion.turnX !== 0) {
				const currentHeadWorldPosition = this.getHeadWorldPosition(state);
				state.heading -= args.locomotion.turnX * options.turnSpeed * args.delta;
				const nextHeadWorldOffset = getHeadWorldOffset(state);
				playerPosition.x = currentHeadWorldPosition.x - nextHeadWorldOffset.x;
				playerPosition.z = currentHeadWorldPosition.z - nextHeadWorldOffset.z;
				referenceSpaceUpdateNeededBool = true;
			}
			const headPositionChangedBool = updateHeadPositionFromInput(state, args.delta, args.locomotion.stanceInputY);
			const headHeight = state.headPosition.y;
			const playerHeight = headHeight + options.playerHeadClearance;
			const worldYaw = getHeadYaw(args.viewerTransform.orientation) + state.heading;
			const supportState = getGroundSupportState(world, playerPosition.x, playerPosition.y, playerPosition.z, headHeight, state.jumpVelocity);
			const groundedBool = supportState.groundedBool;
			if (groundedBool) {
				playerPosition.y = applyGroundSnap(options, playerPosition.y, supportState.floorHeight, args.delta);
				state.jumpCount = 0;
			}
			// Dampen carry-over velocity before applying fresh steering for this frame.
			dampXrHorizontalVelocity(options, state, args.delta, groundedBool);
			applyXrMoveInputVelocity(state, args.delta, args.locomotion.moveX, args.locomotion.moveY, worldYaw, args.locomotion.sprintActiveBool, groundedBool);
			applyJumpInput(options, state, args.locomotion.jumpRequestBool, args.jumpMode, args.delta);
			applyXrAirBoost(options, state, args, groundedBool);
			const horizontalSpeed = applyXrHorizontalMomentum(options, world, state, args.delta, playerHeight, headHeight);
			const verticalResult = applyGravityAndVertical(options, world, state, args.delta, playerHeight, headHeight);
			if (verticalResult.fallResetBool) {
				resetXrLocomotionState(options, state);
				return {referenceSpaceUpdateNeededBool: true, resetBool: true};
			}
			if (verticalResult.airborneBool || verticalResult.groundedBool) {
				referenceSpaceUpdateNeededBool = true;
			} else if (horizontalSpeed > 0.0001 || headPositionChangedBool || renderHeadMovedBool) {
				referenceSpaceUpdateNeededBool = true;
			}
			return {
				referenceSpaceUpdateNeededBool: referenceSpaceUpdateNeededBool,
				resetBool: false
			};
		}
	};
};
