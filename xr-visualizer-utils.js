(function() {
	const tau = Math.PI * 2;

	const clampNumber = function(value, minValue, maxValue) {
		return Math.max(minValue, Math.min(maxValue, value));
	};

	const wrapUnit = function(value) {
		return value - Math.floor(value);
	};

	const unwrapAngle = function(angle, referenceAngle) {
		let unwrappedAngle = angle;
		while (unwrappedAngle - referenceAngle > Math.PI) {
			unwrappedAngle -= tau;
		}
		while (unwrappedAngle - referenceAngle < -Math.PI) {
			unwrappedAngle += tau;
		}
		return unwrappedAngle;
	};

	const extractForwardYawPitch = function(viewMatrix) {
		const forwardX = -viewMatrix[2];
		const forwardY = -viewMatrix[6];
		const forwardZ = -viewMatrix[10];
		const horizontalLength = Math.sqrt(forwardX * forwardX + forwardZ * forwardZ) || 1;
		return {
			yaw: Math.atan2(forwardX, -forwardZ),
			pitch: Math.atan2(forwardY, horizontalLength)
		};
	};

	const extractForwardYawPitchFromQuaternion = function(quaternion) {
		const forwardX = -(2 * (quaternion.x * quaternion.z + quaternion.w * quaternion.y));
		const forwardY = -(2 * (quaternion.y * quaternion.z - quaternion.w * quaternion.x));
		const forwardZ = -(1 - 2 * (quaternion.x * quaternion.x + quaternion.y * quaternion.y));
		const horizontalLength = Math.sqrt(forwardX * forwardX + forwardZ * forwardZ) || 1;
		return {
			yaw: Math.atan2(forwardX, -forwardZ),
			pitch: Math.atan2(forwardY, horizontalLength)
		};
	};

	const extractProjectionFov = function(projectionMatrix) {
		const xScale = projectionMatrix[0] || 1;
		const yScale = projectionMatrix[5] || 1;
		const xOffset = projectionMatrix[8] || 0;
		const yOffset = projectionMatrix[9] || 0;
		const leftTangent = (xOffset - 1) / xScale;
		const rightTangent = (xOffset + 1) / xScale;
		const bottomTangent = (yOffset - 1) / yScale;
		const topTangent = (yOffset + 1) / yScale;
		return {
			horizontal: Math.atan(rightTangent) - Math.atan(leftTangent),
			vertical: Math.atan(topTangent) - Math.atan(bottomTangent)
		};
	};

	window.xrVisualizerUtils = {
		clampNumber: clampNumber,
		wrapUnit: wrapUnit,
		unwrapAngle: unwrapAngle,
		extractForwardYawPitch: extractForwardYawPitch,
		extractForwardYawPitchFromQuaternion: extractForwardYawPitchFromQuaternion,
		extractProjectionFov: extractProjectionFov
	};
})();
