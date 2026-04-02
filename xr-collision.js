// core/movement/collision-world.js
const createCollisionWorld = function(options) {
	const staticBoxes = options.staticBoxes || [];
	const dynamicBoxSources = options.dynamicBoxSources || [];
	const floorHalfSize = options.floorHalfSize || 0;
	const playerRadius = options.playerRadius || 0.32;
	const stepHeight = options.stepHeight || 0.5;

	const getBoxes = function() {
		const boxes = staticBoxes.slice();
		for (let i = 0; i < dynamicBoxSources.length; i += 1) {
			const sourceBoxes = dynamicBoxSources[i]() || [];
			for (let j = 0; j < sourceBoxes.length; j += 1) {
				boxes.push(sourceBoxes[j]);
			}
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
