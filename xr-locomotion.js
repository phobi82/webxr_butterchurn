(function() {
	// Owns collision queries and movement state transitions for XR and desktop.
	const clampNumber = window.xrVisualizerUtils.clampNumber;

	const normalize2d = function(x, y) {
		const length = Math.sqrt(x * x + y * y) || 1;
		return {x: x / length, y: y / length};
	};

	const rotateXZ = function(x, z, yaw) {
		const cosYaw = Math.cos(yaw);
		const sinYaw = Math.sin(yaw);
		return {
			x: x * cosYaw + z * sinYaw,
			z: -x * sinYaw + z * cosYaw
		};
	};

	const getHeadYaw = function(orientation) {
		return Math.atan2(
			2 * (orientation.w * orientation.y + orientation.x * orientation.z),
			1 - 2 * (orientation.y * orientation.y + orientation.z * orientation.z)
		);
	};

	window.createXrLocomotionController = function(options) {
		// Scene collision comes from fixed level boxes plus optional GLB bounds.
		const getCollisionBoxes = function() {
			const boxes = options.levelBoxes.slice();
			const extraBoxes = options.getGlbCollisionBoxes ? options.getGlbCollisionBoxes() : [];
			for (let i = 0; i < extraBoxes.length; i += 1) {
				boxes.push(extraBoxes[i]);
			}
			return boxes;
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
			return currentY + Math.max(options.stepHeight, eyeHeightMeters - 0.5);
		};

		const getFloorHeightAtPosition = function(x, z, maxY) {
			let surfaceY = Math.abs(x) <= options.floorHalfSize && Math.abs(z) <= options.floorHalfSize && 0 <= maxY ? 0 : -Infinity;
			const collisionBoxes = getCollisionBoxes();
			for (let i = 0; i < collisionBoxes.length; i += 1) {
				const bounds = getBoxBounds(collisionBoxes[i]);
				if (
					bounds.maxY <= maxY &&
					x >= bounds.minX - options.playerRadius &&
					x <= bounds.maxX + options.playerRadius &&
					z >= bounds.minZ - options.playerRadius &&
					z <= bounds.maxZ + options.playerRadius
				) {
					surfaceY = Math.max(surfaceY, bounds.maxY);
				}
			}
			return surfaceY;
		};

		// Horizontal motion can step up shallow ledges but blocks on real walls.
		const resolveHorizontalMovement = function(currentX, currentY, currentZ, nextX, nextZ, playerHeight, eyeHeightMeters, momentumState) {
			const bodyMinY = currentY + 0.02;
			const bodyMaxY = currentY + playerHeight;
			const currentSurfaceY = getFloorHeightAtPosition(currentX, currentZ, currentY + 0.05);
			const maxClimbSurfaceY = getMaxClimbSurfaceY(currentY, eyeHeightMeters);
			const collisionBoxes = getCollisionBoxes();
			const canOccupyPosition = function(testX, testZ) {
				const testSurfaceY = getFloorHeightAtPosition(testX, testZ, maxClimbSurfaceY);
				let targetY = currentY;
				for (let i = 0; i < collisionBoxes.length; i += 1) {
					const bounds = getBoxBounds(collisionBoxes[i]);
					if (!rangesOverlap(bodyMinY, bodyMaxY, bounds.minY, bounds.maxY)) {
						continue;
					}
					if (
						testSurfaceY > currentSurfaceY + 0.001 &&
						testSurfaceY <= maxClimbSurfaceY &&
						testX >= bounds.minX - options.playerRadius &&
						testX <= bounds.maxX + options.playerRadius &&
						testZ >= bounds.minZ - options.playerRadius &&
						testZ <= bounds.maxZ + options.playerRadius
					) {
						targetY = Math.max(targetY, testSurfaceY);
						continue;
					}
					if (
						testX >= bounds.minX - options.playerRadius &&
						testX <= bounds.maxX + options.playerRadius &&
						testZ >= bounds.minZ - options.playerRadius &&
						testZ <= bounds.maxZ + options.playerRadius
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

		// Vertical motion resolves landing and head collisions against the same boxes.
		const resolveVerticalMovement = function(previousY, nextY, x, z, playerHeight, eyeHeightMeters, verticalVelocity) {
			let resolvedY = nextY;
			let groundedBool = false;
			let hitCeilingBool = false;
			let supportingSurfaceY = getFloorHeightAtPosition(x, z, getMaxClimbSurfaceY(Math.max(previousY, resolvedY), eyeHeightMeters));
			const collisionBoxes = getCollisionBoxes();
			for (let i = 0; i < collisionBoxes.length; i += 1) {
				const bounds = getBoxBounds(collisionBoxes[i]);
				if (
					x < bounds.minX - options.playerRadius ||
					x > bounds.maxX + options.playerRadius ||
					z < bounds.minZ - options.playerRadius ||
					z > bounds.maxZ + options.playerRadius
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

		// Stick crouch/tiptoe offsets are layered on top of the tracked headset height.
		const updateEyeHeightFromInput = function(state, delta, viewerTransform, stanceInputY) {
			const previousEffectiveEyeHeightMeters = state.effectiveEyeHeightMeters;
			const previousStickEyeHeightOffsetMeters = state.stickEyeHeightOffsetMeters;
			const previousBaseEyeHeightMeters = state.currentBaseEyeHeightMeters;
			state.currentBaseEyeHeightMeters = viewerTransform.position && viewerTransform.position.y ? viewerTransform.position.y : options.defaultEyeHeight;
			if (!state.standingEyeHeightCalibratedBool) {
				state.calibratedStandingEyeHeightMeters = state.currentBaseEyeHeightMeters;
				state.standingEyeHeightCalibratedBool = true;
			}
			const physicalEyeHeightMeters = options.defaultEyeHeight + (state.currentBaseEyeHeightMeters - state.calibratedStandingEyeHeightMeters);
			const neutralEyeHeightMeters = Math.max(options.defaultEyeHeight, physicalEyeHeightMeters);
			const maxEyeHeightMeters = options.defaultEyeHeight + options.tiptoeEyeHeightBoost;
			let nextEyeHeightMeters = clampNumber(physicalEyeHeightMeters + state.stickEyeHeightOffsetMeters, options.crouchMinEyeHeight, maxEyeHeightMeters);
			if (stanceInputY > 0) {
				nextEyeHeightMeters = Math.min(maxEyeHeightMeters, nextEyeHeightMeters + stanceInputY * options.crouchSpeed * delta);
			} else if (stanceInputY < 0) {
				nextEyeHeightMeters = Math.max(options.crouchMinEyeHeight, nextEyeHeightMeters + stanceInputY * options.crouchSpeed * delta);
			} else if (nextEyeHeightMeters > neutralEyeHeightMeters) {
				nextEyeHeightMeters = Math.max(neutralEyeHeightMeters, nextEyeHeightMeters - options.crouchSpeed * delta);
			}
			state.effectiveEyeHeightMeters = nextEyeHeightMeters;
			state.stickEyeHeightOffsetMeters = state.effectiveEyeHeightMeters - physicalEyeHeightMeters;
			return {
				heightChangedBool: Math.abs(state.effectiveEyeHeightMeters - previousEffectiveEyeHeightMeters) > 0.0001,
				offsetChangedBool: Math.abs(state.stickEyeHeightOffsetMeters - previousStickEyeHeightOffsetMeters) > 0.0001,
				baseHeightChangedBool: Math.abs(state.currentBaseEyeHeightMeters - previousBaseEyeHeightMeters) > 0.0001
			};
		};

		const applyWalkingMovement = function(state, delta, moveX, moveY, worldYaw, playerHeight, sprintActiveBool) {
			if (moveX === 0 && moveY === 0) {
				return false;
			}
			const moveVector = normalize2d(moveX, moveY);
			const cosYaw = Math.cos(worldYaw);
			const sinYaw = Math.sin(worldYaw);
			const movementSpeed = options.walkSpeed * (sprintActiveBool ? options.sprintMultiplier : 1);
			const moveStep = resolveHorizontalMovement(
				state.origin.x,
				state.origin.y,
				state.origin.z,
				state.origin.x + (moveVector.y * sinYaw + moveVector.x * cosYaw) * movementSpeed * delta,
				state.origin.z + (moveVector.y * cosYaw - moveVector.x * sinYaw) * movementSpeed * delta,
				playerHeight,
				state.effectiveEyeHeightMeters,
				null
			);
			state.origin.x = moveStep.x;
			state.origin.y = moveStep.y > state.origin.y ? Math.min(moveStep.y, state.origin.y + options.climbSpeed * delta) : moveStep.y;
			state.origin.z = moveStep.z;
			return true;
		};

		return {
			// XR state tracks real headset-relative motion plus airborne momentum.
			createXrState: function() {
				return {
					origin: {x: 0, y: 0, z: 0},
					heading: 0,
					jumpVelocity: 0,
					horizontalVelocityX: 0,
					horizontalVelocityZ: 0,
					currentBaseEyeHeightMeters: options.defaultEyeHeight,
					calibratedStandingEyeHeightMeters: options.defaultEyeHeight,
					standingEyeHeightCalibratedBool: false,
					stickEyeHeightOffsetMeters: 0,
					effectiveEyeHeightMeters: options.defaultEyeHeight,
					jumpCount: 0,
					jumpPressedBool: false,
					jumpHoldTimeSeconds: 0
				};
			},
			// Desktop state mirrors the same jump rules with mouse-look and key movement flags.
			createDesktopState: function() {
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
			},
			resetXrState: function(state) {
				state.origin.x = 0;
				state.origin.y = 0;
				state.origin.z = 0;
				state.heading = 0;
				state.jumpVelocity = 0;
				state.horizontalVelocityX = 0;
				state.horizontalVelocityZ = 0;
				state.currentBaseEyeHeightMeters = options.defaultEyeHeight;
				state.calibratedStandingEyeHeightMeters = options.defaultEyeHeight;
				state.standingEyeHeightCalibratedBool = false;
				state.stickEyeHeightOffsetMeters = 0;
				state.effectiveEyeHeightMeters = options.defaultEyeHeight;
				state.jumpCount = 0;
				state.jumpPressedBool = false;
				state.jumpHoldTimeSeconds = 0;
			},
			resetDesktopState: function(state) {
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
			},
			getPlayerHeight: function(state) {
				return state.effectiveEyeHeightMeters + options.playerHeadClearance;
			},
			// Desktop preview uses the shared collision path so both movement modes stay aligned.
			applyDesktopPreviewMovement: function(state, delta, jumpMode) {
				const playerHeight = state.eyeHeightMeters + options.playerHeadClearance;
				const targetEyeHeightMeters = state.crouchBool ? options.crouchMinEyeHeight : options.defaultEyeHeight;
				if (state.eyeHeightMeters < targetEyeHeightMeters) {
					state.eyeHeightMeters = Math.min(targetEyeHeightMeters, state.eyeHeightMeters + options.crouchSpeed * delta);
				} else if (state.eyeHeightMeters > targetEyeHeightMeters) {
					state.eyeHeightMeters = Math.max(targetEyeHeightMeters, state.eyeHeightMeters - options.crouchSpeed * delta);
				}

				let moveX = 0;
				let moveY = 0;
				if (state.moveLeftBool) {
					moveX -= 1;
				}
				if (state.moveRightBool) {
					moveX += 1;
				}
				if (state.moveForwardBool) {
					moveY -= 1;
				}
				if (state.moveBackwardBool) {
					moveY += 1;
				}
				if (moveX !== 0 || moveY !== 0) {
					const moveVector = normalize2d(moveX, moveY);
					const movementSpeed = options.walkSpeed * (state.sprintBool ? options.sprintMultiplier : 1);
					const moveStep = resolveHorizontalMovement(
						state.origin.x,
						state.origin.y,
						state.origin.z,
						state.origin.x + ((-moveVector.y) * Math.sin(state.lookYaw) + moveVector.x * Math.cos(state.lookYaw)) * movementSpeed * delta,
						state.origin.z + (moveVector.y * Math.cos(state.lookYaw) + moveVector.x * Math.sin(state.lookYaw)) * movementSpeed * delta,
						playerHeight,
						state.eyeHeightMeters,
						null
					);
					state.origin.x = moveStep.x;
					state.origin.y = moveStep.y > state.origin.y ? Math.min(moveStep.y, state.origin.y + options.climbSpeed * delta) : moveStep.y;
					state.origin.z = moveStep.z;
				}

				const floorHeight = getFloorHeightAtPosition(state.origin.x, state.origin.z, getMaxClimbSurfaceY(state.origin.y, state.eyeHeightMeters));
				const groundedBool = floorHeight > -Infinity && state.origin.y <= floorHeight + 0.001 && state.jumpVelocity <= 0;
				if (groundedBool) {
					state.origin.y = floorHeight > state.origin.y ? Math.min(floorHeight, state.origin.y + options.climbSpeed * delta) : floorHeight;
					state.jumpCount = 0;
				}
				if (state.jumpHeldBool && !state.jumpPressedBool && (jumpMode === "multi" || state.jumpCount < options.doubleJumpMaxCount)) {
					state.jumpVelocity = options.jumpSpeed;
					state.jumpHoldTimeSeconds = options.jumpHoldMaxSeconds;
					if (jumpMode === "double") {
						state.jumpCount += 1;
					}
				}
				if (state.jumpHeldBool && state.jumpVelocity > 0 && state.jumpHoldTimeSeconds > 0) {
					state.jumpVelocity += options.jumpHoldBoostSpeed * delta;
					state.jumpHoldTimeSeconds = Math.max(0, state.jumpHoldTimeSeconds - delta);
				}
				if (!state.jumpHeldBool) {
					state.jumpHoldTimeSeconds = 0;
				}
				state.jumpPressedBool = state.jumpHeldBool;

				const supportHeight = getFloorHeightAtPosition(
					state.origin.x,
					state.origin.z,
					getMaxClimbSurfaceY(Math.max(state.origin.y, state.origin.y + state.jumpVelocity * delta), state.eyeHeightMeters)
				);
				if (state.jumpVelocity !== 0 || state.origin.y > supportHeight || supportHeight === -Infinity) {
					const previousY = state.origin.y;
					state.jumpVelocity += options.jumpGravity * delta;
					state.origin.y += state.jumpVelocity * delta;
					const resolvedVertical = resolveVerticalMovement(previousY, state.origin.y, state.origin.x, state.origin.z, playerHeight, state.eyeHeightMeters, state.jumpVelocity);
					state.origin.y = resolvedVertical.y;
					if (resolvedVertical.hitCeilingBool && state.jumpVelocity > 0) {
						state.jumpVelocity = 0;
						state.jumpHoldTimeSeconds = 0;
					}
					if (state.origin.y <= options.fallResetY) {
						this.resetDesktopState(state);
						return {resetBool: true};
					}
					if (resolvedVertical.groundedBool) {
						state.jumpVelocity = 0;
						state.jumpHoldTimeSeconds = 0;
						state.jumpCount = 0;
					}
				}
				return {resetBool: false};
			},
			// XR locomotion keeps turning, walking, boosting, and jumping in one deterministic step.
			applyXrLocomotion: function(state, args) {
				let referenceSpaceUpdateNeededBool = false;
				if (args.locomotion.turnX !== 0 && args.turnAnchorPosition) {
					const offsetWorld = rotateXZ(args.turnAnchorPosition.x, args.turnAnchorPosition.z, state.heading);
					const worldX = state.origin.x + offsetWorld.x;
					const worldZ = state.origin.z + offsetWorld.z;
					state.heading -= args.locomotion.turnX * options.turnSpeed * args.delta;
					const offsetWorldNext = rotateXZ(args.turnAnchorPosition.x, args.turnAnchorPosition.z, state.heading);
					state.origin.x = worldX - offsetWorldNext.x;
					state.origin.z = worldZ - offsetWorldNext.z;
					referenceSpaceUpdateNeededBool = true;
				}
				const eyeHeightState = updateEyeHeightFromInput(state, args.delta, args.viewerTransform, args.locomotion.stanceInputY);
				const worldYaw = getHeadYaw(args.viewerTransform.orientation) + state.heading;
				const playerHeight = this.getPlayerHeight(state);
				if (applyWalkingMovement(state, args.delta, args.locomotion.moveX, args.locomotion.moveY, worldYaw, playerHeight, args.locomotion.sprintActiveBool)) {
					referenceSpaceUpdateNeededBool = true;
				}
				const floorHeight = getFloorHeightAtPosition(state.origin.x, state.origin.z, getMaxClimbSurfaceY(state.origin.y, state.effectiveEyeHeightMeters));
				const groundedBool = floorHeight > -Infinity && state.origin.y <= floorHeight + 0.001 && state.jumpVelocity <= 0;
				if (groundedBool) {
					state.origin.y = floorHeight > state.origin.y ? Math.min(floorHeight, state.origin.y + options.climbSpeed * args.delta) : floorHeight;
					state.jumpCount = 0;
				}
				if (args.locomotion.jumpRequestBool && !state.jumpPressedBool && (args.jumpMode === "multi" || state.jumpCount < options.doubleJumpMaxCount)) {
					state.jumpVelocity = options.jumpSpeed;
					state.jumpHoldTimeSeconds = options.jumpHoldMaxSeconds;
					if (args.jumpMode === "double") {
						state.jumpCount += 1;
					}
				}
				if (args.locomotion.jumpRequestBool && state.jumpVelocity > 0 && state.jumpHoldTimeSeconds > 0) {
					state.jumpVelocity += options.jumpHoldBoostSpeed * args.delta;
					state.jumpHoldTimeSeconds = Math.max(0, state.jumpHoldTimeSeconds - args.delta);
				}
				if (!args.locomotion.jumpRequestBool) {
					state.jumpHoldTimeSeconds = 0;
				}
				state.jumpPressedBool = args.locomotion.jumpRequestBool;
				if (!args.menuOpenBool && args.locomotion.airBoostActiveBool && !groundedBool && args.locomotion.rightControllerBoostDir) {
					state.horizontalVelocityX += args.locomotion.rightControllerBoostDir.x * options.airBoostSpeed * args.delta;
					state.horizontalVelocityZ += args.locomotion.rightControllerBoostDir.z * options.airBoostSpeed * args.delta;
					state.jumpVelocity += args.locomotion.rightControllerBoostDir.y * options.airBoostSpeed * args.delta;
				}
				const horizontalSpeed = Math.sqrt(state.horizontalVelocityX * state.horizontalVelocityX + state.horizontalVelocityZ * state.horizontalVelocityZ);
				const drag = groundedBool ? options.groundMomentumDrag : options.airMomentumDrag;
				const dragFactor = Math.max(0, 1 - drag * args.delta);
				if (horizontalSpeed > 0.0001) {
					const momentumState = {x: state.horizontalVelocityX, z: state.horizontalVelocityZ};
					const resolvedMomentum = resolveHorizontalMovement(
						state.origin.x,
						state.origin.y,
						state.origin.z,
						state.origin.x + momentumState.x * args.delta,
						state.origin.z + momentumState.z * args.delta,
						playerHeight,
						state.effectiveEyeHeightMeters,
						momentumState
					);
					state.origin.x = resolvedMomentum.x;
					state.origin.y = resolvedMomentum.y > state.origin.y ? Math.min(resolvedMomentum.y, state.origin.y + options.climbSpeed * args.delta) : resolvedMomentum.y;
					state.origin.z = resolvedMomentum.z;
					state.horizontalVelocityX = momentumState.x * dragFactor;
					state.horizontalVelocityZ = momentumState.z * dragFactor;
				} else {
					state.horizontalVelocityX = 0;
					state.horizontalVelocityZ = 0;
				}
				const supportHeight = getFloorHeightAtPosition(
					state.origin.x,
					state.origin.z,
					getMaxClimbSurfaceY(Math.max(state.origin.y, state.origin.y + state.jumpVelocity * args.delta), state.effectiveEyeHeightMeters)
				);
				if (state.jumpVelocity !== 0 || state.origin.y > supportHeight || supportHeight === -Infinity) {
					const previousY = state.origin.y;
					state.jumpVelocity += options.jumpGravity * args.delta;
					state.origin.y += state.jumpVelocity * args.delta;
					const resolvedVertical = resolveVerticalMovement(previousY, state.origin.y, state.origin.x, state.origin.z, playerHeight, state.effectiveEyeHeightMeters, state.jumpVelocity);
					state.origin.y = resolvedVertical.y;
					if (resolvedVertical.hitCeilingBool && state.jumpVelocity > 0) {
						state.jumpVelocity = 0;
						state.jumpHoldTimeSeconds = 0;
					}
					if (state.origin.y <= options.fallResetY) {
						this.resetXrState(state);
						return {referenceSpaceUpdateNeededBool: true, resetBool: true};
					}
					if (resolvedVertical.groundedBool) {
						state.jumpVelocity = 0;
						state.jumpHoldTimeSeconds = 0;
						state.horizontalVelocityX *= Math.max(0, 1 - options.groundMomentumDrag * args.delta);
						state.horizontalVelocityZ *= Math.max(0, 1 - options.groundMomentumDrag * args.delta);
						state.jumpCount = 0;
					}
					referenceSpaceUpdateNeededBool = true;
				} else if (horizontalSpeed > 0.0001 || eyeHeightState.heightChangedBool || eyeHeightState.offsetChangedBool || eyeHeightState.baseHeightChangedBool) {
					referenceSpaceUpdateNeededBool = true;
				}
				return {
					referenceSpaceUpdateNeededBool: referenceSpaceUpdateNeededBool,
					resetBool: false
				};
			}
		};
	};
})();
