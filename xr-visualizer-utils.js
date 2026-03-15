(function() {
	// Shared XR math helpers used by the visualizer manager, modes, and main page render loop.
	const tau = Math.PI * 2;

	const clampNumber = function(value, minValue, maxValue) {
		return Math.max(minValue, Math.min(maxValue, value));
	};
	const emptyAudioMetrics = Object.freeze({level: 0, peak: 0, bass: 0, transient: 0, beatPulse: 0});

	const normalizeVec3 = function(x, y, z) {
		const length = Math.sqrt(x * x + y * y + z * z) || 1;
		return {x: x / length, y: y / length, z: z / length};
	};

	const dotVec3 = function(ax, ay, az, bx, by, bz) {
		return ax * bx + ay * by + az * bz;
	};

	const rotateXZ = function(x, z, yaw) {
		const cosYaw = Math.cos(yaw);
		const sinYaw = Math.sin(yaw);
		return {
			x: x * cosYaw + z * sinYaw,
			z: -x * sinYaw + z * cosYaw
		};
	};

	const hueToRgb = function(p, q, t) {
		if (t < 0) {
			t += 1;
		}
		if (t > 1) {
			t -= 1;
		}
		if (t < 1 / 6) {
			return p + (q - p) * 6 * t;
		}
		if (t < 0.5) {
			return q;
		}
		if (t < 2 / 3) {
			return p + (q - p) * (2 / 3 - t) * 6;
		}
		return p;
	};

	const hslToRgb = function(h, s, l) {
		h = ((h % 1) + 1) % 1;
		s = clampNumber(s, 0, 1);
		l = clampNumber(l, 0, 1);
		if (s <= 0.0001) {
			return [l, l, l];
		}
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
		const p = 2 * l - q;
		return [
			hueToRgb(p, q, h + 1 / 3),
			hueToRgb(p, q, h),
			hueToRgb(p, q, h - 1 / 3)
		];
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

	const extractForwardDirectionFromQuaternion = function(quaternion) {
		return normalizeVec3(
			-(2 * (quaternion.x * quaternion.z + quaternion.w * quaternion.y)),
			-(2 * (quaternion.y * quaternion.z - quaternion.w * quaternion.x)),
			-(1 - 2 * (quaternion.x * quaternion.x + quaternion.y * quaternion.y))
		);
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

	const extractCameraPositionFromViewMatrix = function(viewMatrix) {
		const rightX = viewMatrix[0];
		const rightY = viewMatrix[4];
		const rightZ = viewMatrix[8];
		const upX = viewMatrix[1];
		const upY = viewMatrix[5];
		const upZ = viewMatrix[9];
		const forwardX = -viewMatrix[2];
		const forwardY = -viewMatrix[6];
		const forwardZ = -viewMatrix[10];
		const tx = viewMatrix[12];
		const ty = viewMatrix[13];
		const tz = viewMatrix[14];
		return {
			x: -(rightX * tx + rightY * ty + rightZ * tz),
			y: -(upX * tx + upY * ty + upZ * tz),
			z: -((-forwardX) * tx + (-forwardY) * ty + (-forwardZ) * tz)
		};
	};

	window.xrVisualizerUtils = {
		clampNumber: clampNumber,
		emptyAudioMetrics: emptyAudioMetrics,
		normalizeVec3: normalizeVec3,
		dotVec3: dotVec3,
		rotateXZ: rotateXZ,
		hueToRgb: hueToRgb,
		hslToRgb: hslToRgb,
		wrapUnit: wrapUnit,
		unwrapAngle: unwrapAngle,
		extractForwardYawPitch: extractForwardYawPitch,
		extractForwardYawPitchFromQuaternion: extractForwardYawPitchFromQuaternion,
		extractForwardDirectionFromQuaternion: extractForwardDirectionFromQuaternion,
		extractProjectionFov: extractProjectionFov,
		extractCameraPositionFromViewMatrix: extractCameraPositionFromViewMatrix
	};
})();
