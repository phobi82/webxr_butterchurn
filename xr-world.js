// adapters/glb-assets.js
const createGlbAssetStore = function(deps) {
	const gl = deps.gl;
	const fetchFn = deps.fetchFn || fetch;
	const createImageBitmapFn = deps.createImageBitmapFn || null;
	const imageCtor = deps.imageCtor || Image;
	const blobCtor = deps.blobCtor || Blob;
	const textDecoderCtor = deps.textDecoderCtor || TextDecoder;
	const urlApi = deps.urlApi || URL;
	const setStatus = deps.setStatus || function() {};
	const getLightingState = deps.getLightingState || function() { return null; };
	const getLightingUniformLocations = deps.getLightingUniformLocations;
	const applyLightingUniforms = deps.applyLightingUniforms;
	const maxSceneLights = deps.maxSceneLights || 4;
	let litProgram = null;
	let litPositionLoc = null;
	let litNormalLoc = null;
	let litUvLoc = null;
	let litModelLoc = null;
	let litViewLoc = null;
	let litProjLoc = null;
	let litSamplerLoc = null;
	let litLightingUniforms = null;
	const assets = [];

	const loadImageBitmapFromBlob = function(blob) {
		if (createImageBitmapFn) {
			return createImageBitmapFn(blob);
		}
		return new Promise(function(resolve, reject) {
			const image = new imageCtor();
			const imageUrl = urlApi.createObjectURL(blob);
			image.onload = function() {
				urlApi.revokeObjectURL(imageUrl);
				resolve(image);
			};
			image.onerror = function() {
				urlApi.revokeObjectURL(imageUrl);
				reject(new Error("glb texture load failed"));
			};
			image.src = imageUrl;
		});
	};

	const readAccessorTypedArray = function(glbBytes, json, accessorIndex) {
		const accessor = json.accessors[accessorIndex];
		const bufferView = json.bufferViews[accessor.bufferView];
		const componentCount = accessor.type === "VEC3" ? 3 : accessor.type === "VEC2" ? 2 : 1;
		const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
		const elementCount = accessor.count * componentCount;
		if (accessor.componentType === 5126) {
			return new Float32Array(glbBytes.buffer, glbBytes.byteOffset + byteOffset, elementCount);
		}
		if (accessor.componentType === 5125) {
			return new Uint32Array(glbBytes.buffer, glbBytes.byteOffset + byteOffset, elementCount);
		}
		if (accessor.componentType === 5123) {
			return new Uint16Array(glbBytes.buffer, glbBytes.byteOffset + byteOffset, elementCount);
		}
		throw new Error("unsupported glb accessor component type");
	};

	const createWorldMatrix = function(config, baseModelMatrix) {
		return multiplyMatrices(
			translateRotateYScale(config.position.x, config.position.y, config.position.z, config.rotationY || 0, config.scale, config.scale, config.scale),
			baseModelMatrix
		);
	};

	const transformPoint = function(matrix, x, y, z) {
		return {
			x: matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
			y: matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
			z: matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
		};
	};

	const createCollisionBox = function(bounds, worldMatrix) {
		const corners = [
			transformPoint(worldMatrix, bounds.min[0], bounds.min[1], bounds.min[2]),
			transformPoint(worldMatrix, bounds.min[0], bounds.min[1], bounds.max[2]),
			transformPoint(worldMatrix, bounds.min[0], bounds.max[1], bounds.min[2]),
			transformPoint(worldMatrix, bounds.min[0], bounds.max[1], bounds.max[2]),
			transformPoint(worldMatrix, bounds.max[0], bounds.min[1], bounds.min[2]),
			transformPoint(worldMatrix, bounds.max[0], bounds.min[1], bounds.max[2]),
			transformPoint(worldMatrix, bounds.max[0], bounds.max[1], bounds.min[2]),
			transformPoint(worldMatrix, bounds.max[0], bounds.max[1], bounds.max[2])
		];
		let minX = Infinity;
		let minY = Infinity;
		let minZ = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;
		let maxZ = -Infinity;
		for (let i = 0; i < corners.length; i += 1) {
			minX = Math.min(minX, corners[i].x);
			minY = Math.min(minY, corners[i].y);
			minZ = Math.min(minZ, corners[i].z);
			maxX = Math.max(maxX, corners[i].x);
			maxY = Math.max(maxY, corners[i].y);
			maxZ = Math.max(maxZ, corners[i].z);
		}
		return {
			x: (minX + maxX) * 0.5,
			y: (minY + maxY) * 0.5,
			z: (minZ + maxZ) * 0.5,
			width: maxX - minX,
			height: maxY - minY,
			depth: maxZ - minZ
		};
	};

	return {
		init: function() {
			const litVs = "attribute vec3 position;attribute vec3 normal;attribute vec2 uv;uniform mat4 model;uniform mat4 view;uniform mat4 proj;varying vec3 vNormal;varying vec2 vUv;void main(){vNormal=mat3(model)*normal;vUv=uv;gl_Position=proj*view*model*vec4(position,1.0);}";
			const litFs = "precision mediump float;uniform sampler2D tex;uniform vec3 ambientColor;uniform float ambientStrength;uniform vec3 lightDirections[" + maxSceneLights + "];uniform vec3 lightColors[" + maxSceneLights + "];uniform float lightStrengths[" + maxSceneLights + "];varying vec3 vNormal;varying vec2 vUv;void main(){vec3 n=normalize(vNormal);vec3 lightAccum=ambientColor*ambientStrength;for(int i=0;i<" + maxSceneLights + ";i+=1){if(lightStrengths[i]>0.0){float diffuse=max(dot(n,normalize(lightDirections[i])),0.0);lightAccum+=lightColors[i]*(diffuse*lightStrengths[i]);}}vec4 base=texture2D(tex,vUv);gl_FragColor=vec4(base.rgb*min(lightAccum,vec3(1.9)),base.a);}";
			litProgram = createProgram(gl, litVs, litFs, "GLB asset");
			litPositionLoc = gl.getAttribLocation(litProgram, "position");
			litNormalLoc = gl.getAttribLocation(litProgram, "normal");
			litUvLoc = gl.getAttribLocation(litProgram, "uv");
			litModelLoc = gl.getUniformLocation(litProgram, "model");
			litViewLoc = gl.getUniformLocation(litProgram, "view");
			litProjLoc = gl.getUniformLocation(litProgram, "proj");
			litSamplerLoc = gl.getUniformLocation(litProgram, "tex");
			litLightingUniforms = getLightingUniformLocations ? getLightingUniformLocations(gl, litProgram) : null;
			gl.getExtension("OES_element_index_uint");
		},
		loadAsset: async function(config) {
			const response = await fetchFn(config.url, {mode: "cors"});
			if (!response.ok) {
				throw new Error("glb request failed: " + config.url);
			}
			const arrayBuffer = await response.arrayBuffer();
			const bytes = new Uint8Array(arrayBuffer);
			const headerView = new DataView(arrayBuffer, 0, 20);
			if (headerView.getUint32(0, true) !== 0x46546c67) {
				throw new Error("invalid glb header");
			}
			const jsonChunkLength = headerView.getUint32(12, true);
			const jsonText = new textDecoderCtor("utf-8").decode(new Uint8Array(arrayBuffer, 20, jsonChunkLength));
			const json = JSON.parse(jsonText);
			const binaryChunkOffset = 20 + jsonChunkLength + 8;
			const binaryChunkBytes = new Uint8Array(arrayBuffer, binaryChunkOffset);
			const primitive = json.meshes[0].primitives[0];
			const positions = readAccessorTypedArray(binaryChunkBytes, json, primitive.attributes.POSITION);
			const normals = readAccessorTypedArray(binaryChunkBytes, json, primitive.attributes.NORMAL);
			const uvs = readAccessorTypedArray(binaryChunkBytes, json, primitive.attributes.TEXCOORD_0);
			const indices = readAccessorTypedArray(binaryChunkBytes, json, primitive.indices);
			const imageDef = json.images[json.textures[0].source];
			const imageView = json.bufferViews[imageDef.bufferView];
			const imageStart = binaryChunkOffset + (imageView.byteOffset || 0);
			const imageEnd = imageStart + imageView.byteLength;
			const imageBlob = new blobCtor([bytes.slice(imageStart, imageEnd)], {type: imageDef.mimeType || "image/png"});
			const imageBitmap = await loadImageBitmapFromBlob(imageBlob);
			const positionBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
			const normalBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
			const uvBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
			const indexBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
			const texture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageBitmap);
			gl.generateMipmap(gl.TEXTURE_2D);
			const baseModelMatrix = json.nodes && json.nodes[0] && json.nodes[0].matrix ? new Float32Array(json.nodes[0].matrix) : identityMatrix();
			const worldMatrix = createWorldMatrix(config, baseModelMatrix);
			assets.push({
				positionBuffer: positionBuffer,
				normalBuffer: normalBuffer,
				uvBuffer: uvBuffer,
				indexBuffer: indexBuffer,
				indexCount: indices.length,
				indexType: indices instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT,
				worldMatrix: worldMatrix,
				texture: texture,
				collisionBox: config.collisionBool === false ? null : createCollisionBox({min: json.accessors[primitive.attributes.POSITION].min, max: json.accessors[primitive.attributes.POSITION].max}, worldMatrix)
			});
		},
		loadAssets: async function(configs) {
			for (let i = 0; i < configs.length; i += 1) {
				try {
					await this.loadAsset(configs[i]);
				} catch (error) {
					console.warn("[GLB] Failed to load asset: " + (configs[i].url || "unknown") + " — " + (error.message || "unknown error"));
					setStatus(error.message || "glb load failed");
				}
			}
		},
		draw: function(currentView, currentProj) {
			if (!assets.length) {
				return;
			}
			gl.useProgram(litProgram);
			gl.enable(gl.DEPTH_TEST);
			gl.enable(gl.CULL_FACE);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			if (applyLightingUniforms && litLightingUniforms) {
				applyLightingUniforms(gl, litLightingUniforms, getLightingState());
			}
			for (let i = 0; i < assets.length; i += 1) {
				const asset = assets[i];
				gl.bindBuffer(gl.ARRAY_BUFFER, asset.positionBuffer);
				gl.enableVertexAttribArray(litPositionLoc);
				gl.vertexAttribPointer(litPositionLoc, 3, gl.FLOAT, false, 0, 0);
				gl.bindBuffer(gl.ARRAY_BUFFER, asset.normalBuffer);
				gl.enableVertexAttribArray(litNormalLoc);
				gl.vertexAttribPointer(litNormalLoc, 3, gl.FLOAT, false, 0, 0);
				gl.bindBuffer(gl.ARRAY_BUFFER, asset.uvBuffer);
				gl.enableVertexAttribArray(litUvLoc);
				gl.vertexAttribPointer(litUvLoc, 2, gl.FLOAT, false, 0, 0);
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, asset.indexBuffer);
				gl.uniformMatrix4fv(litModelLoc, false, asset.worldMatrix);
				gl.uniformMatrix4fv(litViewLoc, false, currentView);
				gl.uniformMatrix4fv(litProjLoc, false, currentProj);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, asset.texture);
				gl.uniform1i(litSamplerLoc, 0);
				gl.drawElements(gl.TRIANGLES, asset.indexCount, asset.indexType, 0);
			}
		},
		getCollisionBoxes: function() {
			const boxes = [];
			for (let i = 0; i < assets.length; i += 1) {
				if (assets[i].collisionBox) {
					boxes.push(assets[i].collisionBox);
				}
			}
			return boxes;
		}
	};
};

// core/render/geometry.js
const createStaticBuffer = function(gl, values) {
	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
	return buffer;
};

const createSceneGeometry = function(gl) {
	const gridData = [];
	for (let i = -20; i <= 20; i += 1) {
		gridData.push(i, 0, -20, i, 0, 20);
		gridData.push(-20, 0, i, 20, 0, i);
	}
	return {
		floorBuffer: createStaticBuffer(gl, [-1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0, 1]),
		floorNormalBuffer: createStaticBuffer(gl, [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
		gridBuffer: createStaticBuffer(gl, gridData),
		gridVertexCount: gridData.length / 3,
		boxBuffer: createStaticBuffer(gl, [
			-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, -0.5,
			-0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5,
			-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
			-0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
			-0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
			-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5,
			-0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5,
			-0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5,
			-0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5,
			-0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5,
			0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5,
			0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5
		]),
		boxNormalBuffer: createStaticBuffer(gl, [
			0, 0, -1, 0, 0, -1, 0, 0, -1,
			0, 0, -1, 0, 0, -1, 0, 0, -1,
			0, 0, 1, 0, 0, 1, 0, 0, 1,
			0, 0, 1, 0, 0, 1, 0, 0, 1,
			0, -1, 0, 0, -1, 0, 0, -1, 0,
			0, -1, 0, 0, -1, 0, 0, -1, 0,
			0, 1, 0, 0, 1, 0, 0, 1, 0,
			0, 1, 0, 0, 1, 0, 0, 1, 0,
			-1, 0, 0, -1, 0, 0, -1, 0, 0,
			-1, 0, 0, -1, 0, 0, -1, 0, 0,
			1, 0, 0, 1, 0, 0, 1, 0, 0,
			1, 0, 0, 1, 0, 0, 1, 0, 0
		]),
		menuBuffer: createStaticBuffer(gl, [-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0]),
		menuUvBuffer: createStaticBuffer(gl, [0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]),
		lineBuffer: gl.createBuffer()
	};
};

// core/render/scene-renderer.js
const createSceneRenderer = function(options) {
	const canvas = options.canvas;
	const floorReceivesSceneLightingBool = options.floorReceivesSceneLightingBool !== false;
	let gl = null;
	let colorProgram = null;
	let litColorProgram = null;
	let texProgram = null;
	let colorPositionLoc = null;
	let litColorPositionLoc = null;
	let litColorNormalLoc = null;
	let colorModelLoc = null;
	let litColorModelLoc = null;
	let colorViewLoc = null;
	let litColorViewLoc = null;
	let colorProjLoc = null;
	let litColorProjLoc = null;
	let colorUniformLoc = null;
	let litColorUniformLoc = null;
	let litColorLightingUniforms = null;
	let texPositionLoc = null;
	let texUvLoc = null;
	let texModelLoc = null;
	let texViewLoc = null;
	let texProjLoc = null;
	let texSamplerLoc = null;
	let menuTexture = null;
	let passthroughOverlayRenderer = null;
	let punchRenderer = null;
	let worldMaskCompositeRenderer = null;
	let processedDepthRenderer = null;
	let geometry = null;
	let webgl2Bool = false;
	const currentView = new Float32Array(16);
	const currentProj = new Float32Array(16);
	const currentPassthroughView = new Float32Array(16);
	const currentPassthroughProj = new Float32Array(16);
	const adjustedView = new Float32Array(16);
	const colorVec4 = new Float32Array(4);
	// pre-allocated buffers to avoid per-frame garbage in render loop
	const overlayLineData = new Float32Array(6);
	const reusableRayEnd = {x: 0, y: 0, z: 0};
	const reusableAdjustedEye = {x: 0, y: 0, z: 0};
	const emptyMenuController = {
		getState: function() {
			return {
				floorAlpha: 0.72,
				menuOpenBool: false,
				plane: {
					center: {x: 0, y: 0, z: 0},
					right: {x: 1, y: 0, z: 0},
					up: {x: 0, y: 1, z: 0},
					normal: {x: 0, y: 0, z: 1}
				},
				planeWidth: options.menuWidth || 0.74,
				planeHeight: (options.menuWidth || 0.74) * 0.75
			};
		},
		getControllerRays: function() {
			return [];
		},
		renderTexture: function() {}
	};

	const perspectiveMatrix = function(fovRadians, aspect, near, far) {
		const f = 1 / Math.tan(fovRadians * 0.5);
		const rangeInv = 1 / (near - far);
		return new Float32Array([
			f / aspect, 0, 0, 0,
			0, f, 0, 0,
			0, 0, (near + far) * rangeInv, -1,
			0, 0, near * far * rangeInv * 2, 0
		]);
	};

	const createViewMatrixFromYawPitch = function(eyeX, eyeY, eyeZ, yaw, pitch) {
		const cosYaw = Math.cos(yaw);
		const sinYaw = Math.sin(yaw);
		const cosPitch = Math.cos(pitch);
		const sinPitch = Math.sin(pitch);
		const xAxis = {x: cosYaw, y: 0, z: sinYaw};
		const yAxis = {x: -sinYaw * sinPitch, y: cosPitch, z: cosYaw * sinPitch};
		const zAxis = {x: -sinYaw * cosPitch, y: -sinPitch, z: cosYaw * cosPitch};
		return new Float32Array([
			xAxis.x, yAxis.x, zAxis.x, 0,
			xAxis.y, yAxis.y, zAxis.y, 0,
			xAxis.z, yAxis.z, zAxis.z, 0,
			-(xAxis.x * eyeX + xAxis.y * eyeY + xAxis.z * eyeZ),
			-(yAxis.x * eyeX + yAxis.y * eyeY + yAxis.z * eyeZ),
			-(zAxis.x * eyeX + zAxis.y * eyeY + zAxis.z * eyeZ),
			1
		]);
	};

	const invertRigidViewMatrix = function(target, matrix, eyeX, eyeY, eyeZ) {
		target[0] = matrix[0];
		target[1] = matrix[4];
		target[2] = matrix[8];
		target[3] = 0;
		target[4] = matrix[1];
		target[5] = matrix[5];
		target[6] = matrix[9];
		target[7] = 0;
		target[8] = matrix[2];
		target[9] = matrix[6];
		target[10] = matrix[10];
		target[11] = 0;
		target[12] = -(target[0] * eyeX + target[4] * eyeY + target[8] * eyeZ);
		target[13] = -(target[1] * eyeX + target[5] * eyeY + target[9] * eyeZ);
		target[14] = -(target[2] * eyeX + target[6] * eyeY + target[10] * eyeZ);
		target[15] = 1;
	};

	const getAdjustedEyePosition = function(view, pose, eyeDistanceMeters) {
		const center = pose.transform.position;
		const eye = view.transform.position;
		const offsetX = eye.x - center.x;
		const offsetY = eye.y - center.y;
		const offsetZ = eye.z - center.z;
		const offsetLength = Math.sqrt(offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ);
		if (offsetLength < 0.000001) {
			reusableAdjustedEye.x = eye.x;
			reusableAdjustedEye.y = eye.y;
			reusableAdjustedEye.z = eye.z;
			return reusableAdjustedEye;
		}
		const scale = (eyeDistanceMeters * 0.5) / offsetLength;
		reusableAdjustedEye.x = center.x + offsetX * scale;
		reusableAdjustedEye.y = center.y + offsetY * scale;
		reusableAdjustedEye.z = center.z + offsetZ * scale;
		return reusableAdjustedEye;
	};

	const setColorUniform = function(uniformLoc, color) {
		colorVec4[0] = color[0];
		colorVec4[1] = color[1];
		colorVec4[2] = color[2];
		colorVec4[3] = color[3];
		gl.uniform4fv(uniformLoc, colorVec4);
	};

	const drawColor = function(buffer, count, mode, model, color) {
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.useProgram(colorProgram);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(colorPositionLoc);
		gl.vertexAttribPointer(colorPositionLoc, 3, gl.FLOAT, false, 0, 0);
		gl.uniformMatrix4fv(colorModelLoc, false, model);
		gl.uniformMatrix4fv(colorViewLoc, false, currentView);
		gl.uniformMatrix4fv(colorProjLoc, false, currentProj);
		setColorUniform(colorUniformLoc, color);
		gl.drawArrays(mode, 0, count);
	};

	const drawLitColor = function(positionBuffer, normalBuffer, count, mode, model, color, sceneLighting) {
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.useProgram(litColorProgram);
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.enableVertexAttribArray(litColorPositionLoc);
		gl.vertexAttribPointer(litColorPositionLoc, 3, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
		gl.enableVertexAttribArray(litColorNormalLoc);
		gl.vertexAttribPointer(litColorNormalLoc, 3, gl.FLOAT, false, 0, 0);
		gl.uniformMatrix4fv(litColorModelLoc, false, model);
		gl.uniformMatrix4fv(litColorViewLoc, false, currentView);
		gl.uniformMatrix4fv(litColorProjLoc, false, currentProj);
		setColorUniform(litColorUniformLoc, color);
		if (options.applyLightingUniforms && litColorLightingUniforms && sceneLighting) {
			options.applyLightingUniforms(gl, litColorLightingUniforms, sceneLighting.getState());
		}
		gl.drawArrays(mode, 0, count);
	};

	const drawTexturedPlane = function(model) {
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.useProgram(texProgram);
		gl.bindBuffer(gl.ARRAY_BUFFER, geometry.menuBuffer);
		gl.enableVertexAttribArray(texPositionLoc);
		gl.vertexAttribPointer(texPositionLoc, 3, gl.FLOAT, false, 0, 0);
		gl.bindBuffer(gl.ARRAY_BUFFER, geometry.menuUvBuffer);
		gl.enableVertexAttribArray(texUvLoc);
		gl.vertexAttribPointer(texUvLoc, 2, gl.FLOAT, false, 0, 0);
		gl.uniformMatrix4fv(texModelLoc, false, model);
		gl.uniformMatrix4fv(texViewLoc, false, currentView);
		gl.uniformMatrix4fv(texProjLoc, false, currentProj);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, menuTexture);
		gl.uniform1i(texSamplerLoc, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	};

	const drawFloor = function(sceneLighting, reactiveColors) {
		const worldAlpha = reactiveColors.floor[3];
		gl.disable(gl.CULL_FACE);
		if (floorReceivesSceneLightingBool) {
			drawLitColor(geometry.floorBuffer, geometry.floorNormalBuffer, 6, gl.TRIANGLES, translateScale(0, -0.01, 0, options.floorHalfSize, 1, options.floorHalfSize), reactiveColors.floor, sceneLighting);
		} else {
			drawColor(geometry.floorBuffer, 6, gl.TRIANGLES, translateScale(0, -0.01, 0, options.floorHalfSize, 1, options.floorHalfSize), reactiveColors.floor);
		}
		drawColor(geometry.gridBuffer, geometry.gridVertexCount, gl.LINES, identityMatrix(), reactiveColors.grid);
		for (let i = 0; i < options.levelBoxes.length; i += 1) {
			const box = options.levelBoxes[i];
			const pulse = options.clampNumber(reactiveColors.audioLevel * 0.4 + reactiveColors.beatPulse * 0.75 + reactiveColors.transient * 1.8, 0, 1);
			drawLitColor(
				geometry.boxBuffer,
				geometry.boxNormalBuffer,
				36,
				gl.TRIANGLES,
				translateScale(box.x, box.y, box.z, box.width, box.height, box.depth),
				[
					options.clampNumber(box.color[0] + pulse * 0.25, 0, 1),
					options.clampNumber(box.color[1] + pulse * 0.25, 0, 1),
					options.clampNumber(box.color[2] + pulse * 0.25, 0, 1),
					options.clampNumber((box.color[3] + reactiveColors.beatPulse * 0.12) * worldAlpha, 0, 0.95)
				],
				sceneLighting
			);
		}
		gl.enable(gl.CULL_FACE);
	};

	const drawWorldLayer = function(args) {
		const menuState = args.menuController ? args.menuController.getState() : emptyMenuController.getState();
		if (menuState.floorAlpha > 0.001) {
			drawFloor(args.sceneLighting, args.getReactiveFloorColors());
		}
		if (args.glbAssetStore) {
			args.glbAssetStore.draw(currentView, currentProj);
		}
		if (args.visualizerEngine) {
			args.visualizerEngine.drawWorld();
		}
	};

	const drawDepthMaskedLayer = function(args, worldMaskState, drawCallback) {
		if (!worldMaskCompositeRenderer || !worldMaskState || !drawCallback) {
			return;
		}
		worldMaskCompositeRenderer.beginWorldPass(args.targetViewport.width, args.targetViewport.height);
		drawCallback();
		gl.bindFramebuffer(gl.FRAMEBUFFER, args.outputFramebuffer || null);
		gl.viewport(args.targetViewport.x, args.targetViewport.y, args.targetViewport.width, args.targetViewport.height);
		worldMaskCompositeRenderer.compositeWorld(worldMaskState, args.processedDepthInfo, args.processedDepthFrameKind || "", args.processedDepthProfile);
	};

	const createProcessedDepthRenderer = function() {
		return createDepthProcessingRenderer({gl: gl, webgl2Bool: webgl2Bool});
	};

	const createWorldMaskCompositeRenderer = function() {
		let buffer = null;
		let framebuffer = null;
		let colorTexture = null;
		let depthBuffer = null;
		let texture2dProgram = null;
		let texture2dLocs = null;
		let gpuArrayProgram = null;
		let gpuArrayLocs = null;
		let cpuDepthTexture = null;
		let cpuUploadBuffer = null;
		let targetWidth = 0;
		let targetHeight = 0;
		const depthUvTransform = new Float32Array(16);
		const buildLocs = function(program) {
			return {
				position: gl.getAttribLocation(program, "position"),
				worldTexture: gl.getUniformLocation(program, "worldTexture"),
				depthTexture: gl.getUniformLocation(program, "depthTexture"),
				depthTextureLayer: gl.getUniformLocation(program, "depthTextureLayer"),
				depthMode: gl.getUniformLocation(program, "depthMode"),
				depthThreshold: gl.getUniformLocation(program, "depthThreshold"),
				depthFade: gl.getUniformLocation(program, "depthFade"),
				depthEchoWavelength: gl.getUniformLocation(program, "depthEchoWavelength"),
				depthEchoDutyCycle: gl.getUniformLocation(program, "depthEchoDutyCycle"),
				depthEchoFade: gl.getUniformLocation(program, "depthEchoFade"),
				depthPhaseOffset: gl.getUniformLocation(program, "depthPhaseOffset"),
				rawValueToMeters: gl.getUniformLocation(program, "rawValueToMeters"),
				depthNearZ: gl.getUniformLocation(program, "depthNearZ"),
				depthMetricMode: gl.getUniformLocation(program, "depthMetricMode"),
				depthProjectionParams: gl.getUniformLocation(program, "depthProjectionParams"),
				depthUvTransform: gl.getUniformLocation(program, "depthUvTransform")
			};
		};
		const ensureRenderTarget = function(width, height) {
			if (width === targetWidth && height === targetHeight && framebuffer && colorTexture && depthBuffer) {
				return;
			}
			targetWidth = Math.max(1, width | 0);
			targetHeight = Math.max(1, height | 0);
			if (!framebuffer) {
				framebuffer = gl.createFramebuffer();
			}
			if (!colorTexture) {
				colorTexture = gl.createTexture();
			}
			if (!depthBuffer) {
				depthBuffer = gl.createRenderbuffer();
			}
			gl.bindTexture(gl.TEXTURE_2D, colorTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, targetWidth, targetHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
			gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, targetWidth, targetHeight);
			gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, colorTexture, 0);
			gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer);
		};
		const worldCompositeVertSource = [
			"attribute vec2 position;",
			"varying vec2 vScreenUv;",
			"void main(){",
			"vScreenUv=position*0.5+0.5;",
			"gl_Position=vec4(position,0.0,1.0);",
			"}"
		].join("");
		const worldCompositeTexture2dFragSource = [
			"precision highp float;",
			"uniform sampler2D worldTexture;",
			"uniform sampler2D depthTexture;",
			"uniform float depthMode;",
			"uniform float depthThreshold;",
			"uniform float depthFade;",
			"uniform float depthEchoWavelength;",
			"uniform float depthEchoDutyCycle;",
			"uniform float depthEchoFade;",
			"uniform float depthPhaseOffset;",
			"uniform float rawValueToMeters;",
			"uniform float depthNearZ;",
			"uniform float depthMetricMode;",
			"uniform vec4 depthProjectionParams;",
			"uniform mat4 depthUvTransform;",
			"varying vec2 vScreenUv;",
			"float computeDepthVisibility(float depthMeters){",
			"if(depthMode<0.5){return depthFade<=0.0001?step(depthThreshold,depthMeters):smoothstep(max(0.0,depthThreshold-depthFade*0.5),depthThreshold+depthFade*0.5,depthMeters);}",
			"float wavelength=max(depthEchoWavelength,0.0001);",
			"float dutyCycle=clamp(depthEchoDutyCycle,0.0,1.0);",
			"float visibleWidth=wavelength*dutyCycle;",
			"if(visibleWidth<=0.0001){return 0.0;}",
			"if(visibleWidth>=wavelength-0.0001){return 1.0;}",
			"float halfPeriod=wavelength*0.5;",
			"float centeredPhase=mod(depthMeters-depthPhaseOffset+halfPeriod,wavelength)-halfPeriod;",
			"float distanceFromBandCenter=abs(centeredPhase);",
			"float hiddenWidth=wavelength-visibleWidth;",
			"float visibleHalfWidth=visibleWidth*0.5;",
			"float fadeHalfWidth=0.5*min(visibleWidth,hiddenWidth)*clamp(depthEchoFade,0.0,1.0);",
			"if(fadeHalfWidth<=0.0001){return step(distanceFromBandCenter,visibleHalfWidth);}",
			"float innerEdge=max(0.0,visibleHalfWidth-fadeHalfWidth);",
			"float outerEdge=visibleHalfWidth+fadeHalfWidth;",
			"return 1.0-smoothstep(innerEdge,outerEdge,distanceFromBandCenter);",
			"}",
			"float resolveDepthMetric(float depthMeters){",
			"if(depthMetricMode<0.5){return depthMeters;}",
			"vec2 ndc=vScreenUv*2.0-1.0;",
			"vec2 viewRay=vec2((ndc.x+depthProjectionParams.z)/depthProjectionParams.x,(ndc.y+depthProjectionParams.w)/depthProjectionParams.y);",
			"return depthMeters*sqrt(1.0+dot(viewRay,viewRay));",
			"}",
			"void main(){",
			"vec4 worldColor=texture2D(worldTexture,vScreenUv);",
			"vec2 depthUv=(depthUvTransform*vec4(vScreenUv,0.0,1.0)).xy;",
			"float rawDepth=texture2D(depthTexture,depthUv).r;",
			"float valid=step(0.001,rawDepth);",
			"float depthMeters=depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
			"float visibility=valid>0.0?computeDepthVisibility(resolveDepthMetric(depthMeters)):1.0;",
			"gl_FragColor=vec4(worldColor.rgb,worldColor.a*visibility);",
			"}"
		].join("");
		const worldCompositeGpuArrayVertSource = [
			"#version 300 es\n",
			"in vec2 position;",
			"out vec2 vScreenUv;",
			"void main(){",
			"vScreenUv=position*0.5+0.5;",
			"gl_Position=vec4(position,0.0,1.0);",
			"}"
		].join("");
		const worldCompositeGpuArrayFragSource = [
			"#version 300 es\n",
			"precision highp float;",
			"precision mediump sampler2DArray;",
			"uniform sampler2D worldTexture;",
			"uniform sampler2DArray depthTexture;",
			"uniform int depthTextureLayer;",
			"uniform float depthMode;",
			"uniform float depthThreshold;",
			"uniform float depthFade;",
			"uniform float depthEchoWavelength;",
			"uniform float depthEchoDutyCycle;",
			"uniform float depthEchoFade;",
			"uniform float depthPhaseOffset;",
			"uniform float rawValueToMeters;",
			"uniform float depthNearZ;",
			"uniform float depthMetricMode;",
			"uniform vec4 depthProjectionParams;",
			"uniform mat4 depthUvTransform;",
			"in vec2 vScreenUv;",
			"out vec4 fragColor;",
			"float computeDepthVisibility(float depthMeters){",
			"if(depthMode<0.5){return depthFade<=0.0001?step(depthThreshold,depthMeters):smoothstep(max(0.0,depthThreshold-depthFade*0.5),depthThreshold+depthFade*0.5,depthMeters);}",
			"float wavelength=max(depthEchoWavelength,0.0001);",
			"float dutyCycle=clamp(depthEchoDutyCycle,0.0,1.0);",
			"float visibleWidth=wavelength*dutyCycle;",
			"if(visibleWidth<=0.0001){return 0.0;}",
			"if(visibleWidth>=wavelength-0.0001){return 1.0;}",
			"float halfPeriod=wavelength*0.5;",
			"float centeredPhase=mod(depthMeters-depthPhaseOffset+halfPeriod,wavelength)-halfPeriod;",
			"float distanceFromBandCenter=abs(centeredPhase);",
			"float hiddenWidth=wavelength-visibleWidth;",
			"float visibleHalfWidth=visibleWidth*0.5;",
			"float fadeHalfWidth=0.5*min(visibleWidth,hiddenWidth)*clamp(depthEchoFade,0.0,1.0);",
			"if(fadeHalfWidth<=0.0001){return step(distanceFromBandCenter,visibleHalfWidth);}",
			"float innerEdge=max(0.0,visibleHalfWidth-fadeHalfWidth);",
			"float outerEdge=visibleHalfWidth+fadeHalfWidth;",
			"return 1.0-smoothstep(innerEdge,outerEdge,distanceFromBandCenter);",
			"}",
			"float resolveDepthMetric(float depthMeters){",
			"if(depthMetricMode<0.5){return depthMeters;}",
			"vec2 ndc=vScreenUv*2.0-1.0;",
			"vec2 viewRay=vec2((ndc.x+depthProjectionParams.z)/depthProjectionParams.x,(ndc.y+depthProjectionParams.w)/depthProjectionParams.y);",
			"return depthMeters*sqrt(1.0+dot(viewRay,viewRay));",
			"}",
			"void main(){",
			"vec4 worldColor=texture(worldTexture,vScreenUv);",
			"vec2 depthUv=(depthUvTransform*vec4(vScreenUv,0.0,1.0)).xy;",
			"float rawDepth=texture(depthTexture,vec3(depthUv,float(depthTextureLayer))).r;",
			"float valid=step(0.001,rawDepth);",
			"float depthMeters=depthNearZ>0.0?depthNearZ/max(1.0-rawDepth,0.0001):rawDepth*rawValueToMeters;",
			"float visibility=valid>0.0?computeDepthVisibility(resolveDepthMetric(depthMeters)):1.0;",
			"fragColor=vec4(worldColor.rgb,worldColor.a*visibility);",
			"}"
		].join("");
		return {
			init: function() {
				buffer = createFullscreenTriangleBuffer(gl);
			},
			beginWorldPass: function(width, height) {
				ensureRenderTarget(width, height);
				gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
				gl.viewport(0, 0, targetWidth, targetHeight);
				gl.clearColor(0, 0, 0, 0);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			},
			compositeWorld: function(worldMaskState, depthInfo, depthFrameKind, depthProfile) {
				if (!worldMaskState || !depthInfo || !colorTexture) {
					return;
				}
				let cpuTextureBoundBool = false;
				const profile = depthProfile || {linearScale: depthInfo.rawValueToMeters || 0.001, nearZ: 0};
				if (depthFrameKind === "cpu") {
					if (!depthInfo.data || !depthInfo.width || !depthInfo.height) {
						return;
					}
					if (!cpuDepthTexture) {
						cpuDepthTexture = gl.createTexture();
					}
					const pixelCount = depthInfo.width * depthInfo.height;
					if (!cpuUploadBuffer || cpuUploadBuffer.length < pixelCount) {
						cpuUploadBuffer = new Float32Array(pixelCount);
					}
					const src = new Uint16Array(depthInfo.data);
					for (let i = 0; i < pixelCount; i += 1) {
						cpuUploadBuffer[i] = src[i];
					}
					gl.activeTexture(gl.TEXTURE1);
					gl.bindTexture(gl.TEXTURE_2D, cpuDepthTexture);
					if (webgl2Bool) {
						gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, depthInfo.width, depthInfo.height, 0, gl.RED, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
					} else {
						gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, depthInfo.width, depthInfo.height, 0, gl.LUMINANCE, gl.FLOAT, cpuUploadBuffer.subarray(0, pixelCount));
					}
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
					cpuTextureBoundBool = true;
				} else if (!depthInfo.texture) {
					return;
				}
				let program = null;
				let locs = null;
				if (depthFrameKind === "gpu-array" && webgl2Bool) {
					if (!gpuArrayProgram) {
						gpuArrayProgram = createProgram(gl, worldCompositeGpuArrayVertSource, worldCompositeGpuArrayFragSource, "World composite gpu-array");
						gpuArrayLocs = buildLocs(gpuArrayProgram);
					}
					program = gpuArrayProgram;
					locs = gpuArrayLocs;
				} else {
					if (!texture2dProgram) {
						texture2dProgram = createProgram(gl, worldCompositeVertSource, worldCompositeTexture2dFragSource, "World composite texture2d");
						texture2dLocs = buildLocs(texture2dProgram);
					}
					program = texture2dProgram;
					locs = texture2dLocs;
				}
				gl.useProgram(program);
				gl.disable(gl.DEPTH_TEST);
				gl.disable(gl.CULL_FACE);
				gl.enable(gl.BLEND);
				gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, colorTexture);
				gl.uniform1i(locs.worldTexture, 0);
				gl.activeTexture(gl.TEXTURE1);
				if (cpuTextureBoundBool) {
					// already bound above
				} else if (depthFrameKind === "gpu-array" && webgl2Bool) {
					gl.bindTexture(gl.TEXTURE_2D_ARRAY, depthInfo.texture);
					if (locs.depthTextureLayer) {
						gl.uniform1i(locs.depthTextureLayer, depthInfo.imageIndex != null ? depthInfo.imageIndex : (depthInfo.textureLayer || 0));
					}
				} else {
					gl.bindTexture(gl.TEXTURE_2D, depthInfo.texture);
				}
				gl.uniform1i(locs.depthTexture, 1);
				gl.uniform1f(locs.depthMode, worldMaskState.depthMode == null ? 0 : worldMaskState.depthMode);
				gl.uniform1f(locs.depthThreshold, worldMaskState.depthThreshold);
				gl.uniform1f(locs.depthFade, worldMaskState.depthFade);
				gl.uniform1f(locs.depthEchoWavelength, worldMaskState.depthEchoWavelength == null ? 1 : worldMaskState.depthEchoWavelength);
				gl.uniform1f(locs.depthEchoDutyCycle, worldMaskState.depthEchoDutyCycle == null ? 0.5 : worldMaskState.depthEchoDutyCycle);
				gl.uniform1f(locs.depthEchoFade, worldMaskState.depthEchoFade == null ? 0 : worldMaskState.depthEchoFade);
				gl.uniform1f(locs.depthPhaseOffset, worldMaskState.depthPhaseOffset == null ? 0 : worldMaskState.depthPhaseOffset);
				gl.uniform1f(locs.rawValueToMeters, profile.linearScale);
				gl.uniform1f(locs.depthNearZ, profile.nearZ);
				gl.uniform1f(locs.depthMetricMode, worldMaskState.depthRadialBool ? 1 : 0);
				gl.uniform4f(
					locs.depthProjectionParams,
					worldMaskState.depthProjectionParams ? worldMaskState.depthProjectionParams.xScale : 1,
					worldMaskState.depthProjectionParams ? worldMaskState.depthProjectionParams.yScale : 1,
					worldMaskState.depthProjectionParams ? worldMaskState.depthProjectionParams.xOffset : 0,
					worldMaskState.depthProjectionParams ? worldMaskState.depthProjectionParams.yOffset : 0
				);
				if (depthInfo.normDepthBufferFromNormView && depthInfo.normDepthBufferFromNormView.matrix) {
					depthUvTransform.set(depthInfo.normDepthBufferFromNormView.matrix);
				} else if (depthInfo.normDepthBufferFromNormView) {
					depthUvTransform.set(depthInfo.normDepthBufferFromNormView);
				} else {
					depthUvTransform[0] = 1; depthUvTransform[1] = 0; depthUvTransform[2] = 0; depthUvTransform[3] = 0;
					depthUvTransform[4] = 0; depthUvTransform[5] = 1; depthUvTransform[6] = 0; depthUvTransform[7] = 0;
					depthUvTransform[8] = 0; depthUvTransform[9] = 0; depthUvTransform[10] = 1; depthUvTransform[11] = 0;
					depthUvTransform[12] = 0; depthUvTransform[13] = 0; depthUvTransform[14] = 0; depthUvTransform[15] = 1;
				}
				gl.uniformMatrix4fv(locs.depthUvTransform, false, depthUvTransform);
				gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
				gl.enableVertexAttribArray(locs.position);
				gl.vertexAttribPointer(locs.position, 2, gl.FLOAT, false, 0, 0);
				gl.drawArrays(gl.TRIANGLES, 0, 3);
				gl.enable(gl.CULL_FACE);
				gl.enable(gl.DEPTH_TEST);
			}
		};
	};

	const drawOverlayLine = function(start, end, pointBool, color) {
		overlayLineData[0] = start.x;
		overlayLineData[1] = start.y;
		overlayLineData[2] = start.z;
		if (!pointBool) {
			overlayLineData[3] = end.x;
			overlayLineData[4] = end.y;
			overlayLineData[5] = end.z;
		}
		gl.bindBuffer(gl.ARRAY_BUFFER, geometry.lineBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, pointBool ? overlayLineData.subarray(0, 3) : overlayLineData, gl.DYNAMIC_DRAW);
		drawColor(geometry.lineBuffer, pointBool ? 1 : 2, pointBool ? gl.POINTS : gl.LINES, identityMatrix(), color);
	};

	const renderScene = function(args) {
		const menuController = args.menuController || emptyMenuController;
		const menuState = menuController.getState();
		const passthroughController = args.passthroughController || null;
		const visualizerBackgroundEnabledBool = args.visualizerBackgroundEnabledBool !== false;
		const controllerRays = menuController.getControllerRays();
		const sceneLightingState = args.sceneLighting && args.sceneLighting.getState ? args.sceneLighting.getState() : null;
		const passthroughViewMatrix = args.passthroughViewMatrix || currentView;
		const passthroughProjMatrix = args.passthroughProjMatrix || currentProj;
		const punchState = passthroughController && passthroughController.getPunchRenderState ? passthroughController.getPunchRenderState({
			viewMatrix: currentView,
			projMatrix: currentProj,
			controllerRays: controllerRays
		}) : null;
		const worldMaskActiveBool = !!(worldMaskCompositeRenderer && punchState && punchState.worldMask && args.processedDepthInfo && (args.transparentBackgroundBool || args.passthroughFallbackBool));
		// Layer 1: Visualizer Background
		if (visualizerBackgroundEnabledBool && args.visualizerEngine && passthroughController && passthroughController.getBackgroundCompositeState) {
			applyVisualizerBackgroundComposite(args.visualizerEngine, passthroughController.getBackgroundCompositeState());
		}
		if (visualizerBackgroundEnabledBool && args.visualizerEngine) {
			if (worldMaskActiveBool) {
				drawDepthMaskedLayer(args, punchState.worldMask, function() {
					args.visualizerEngine.drawPreScene();
				});
			} else {
				args.visualizerEngine.drawPreScene();
			}
		}
		// Layer 2: Modified Reality Overlay
		if (passthroughOverlayRenderer && (args.transparentBackgroundBool || args.passthroughFallbackBool)) {
			passthroughOverlayRenderer.draw(passthroughController && passthroughController.getOverlayRenderState ? passthroughController.getOverlayRenderState({
				viewMatrix: passthroughViewMatrix,
				projMatrix: passthroughProjMatrix,
				depthProjMatrix: currentProj,
				controllerRays: controllerRays,
				sceneLightingState: sceneLightingState,
				depthInfo: args.rawPassthroughDepthInfo || null
			}) : null, args.processedDepthInfo, args.processedDepthFrameKind || "", webgl2Bool, args.processedDepthProfile);
		}
		// Layer 3: VR World
		if (worldMaskActiveBool) {
			drawDepthMaskedLayer(args, punchState.worldMask, function() {
				drawWorldLayer(args);
			});
		} else {
			drawWorldLayer(args);
		}
		// Layer 4: Punch (Flashlight or Depth — before menu/rays)
		if (punchRenderer && (args.transparentBackgroundBool || args.passthroughFallbackBool) && punchState) {
			punchRenderer.draw(punchState, args.processedDepthInfo, args.processedDepthFrameKind || "", webgl2Bool, args.processedDepthProfile);
		}
		// Post-scene (reserved, currently no-op)
		if (args.visualizerEngine) {
			args.visualizerEngine.drawPostScene();
		}
		// Always visible: Menu
		if (menuState.menuOpenBool) {
			menuController.renderTexture(gl, menuTexture, args.menuContentState);
			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.CULL_FACE);
			drawTexturedPlane(basisScale(menuState.plane.center.x, menuState.plane.center.y, menuState.plane.center.z, menuState.plane.right, menuState.plane.up, menuState.plane.normal, menuState.planeWidth, menuState.planeHeight, 1));
			gl.enable(gl.CULL_FACE);
			gl.enable(gl.DEPTH_TEST);
		}
		// Always visible: Controller Rays
		for (let i = 0; i < controllerRays.length; i += 1) {
			const ray = controllerRays[i];
			reusableRayEnd.x = ray.origin.x + ray.dir.x * ray.length;
			reusableRayEnd.y = ray.origin.y + ray.dir.y * ray.length;
			reusableRayEnd.z = ray.origin.z + ray.dir.z * ray.length;
			drawOverlayLine(ray.origin, reusableRayEnd, false, ray.hitBool ? [1, 0.95, 0.2, 0.95] : [1, 0.2, 0.2, 0.9]);
			if (ray.hitPoint) {
				drawOverlayLine(ray.hitPoint, null, true, [0.2, 1, 0.2, 1]);
			}
		}
	};

	return {
		createProgram: function(vsSource, fsSource) {
			return createProgram(gl, vsSource, fsSource, "Scene renderer");
		},
		isWebGL2: function() { return webgl2Bool; },
		init: function() {
			gl = canvas.getContext("webgl2", {xrCompatible: true, antialias: true, alpha: true}) || canvas.getContext("webgl", {xrCompatible: true, antialias: true, alpha: true});
			webgl2Bool = !!gl && typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
			if (!gl) {
				options.onInitFailure();
				return null;
			}
			const colorVs = "attribute vec3 position;uniform mat4 model;uniform mat4 view;uniform mat4 proj;void main(){gl_Position=proj*view*model*vec4(position,1.0);}";
			const colorFs = "precision mediump float;uniform vec4 color;void main(){gl_FragColor=color;}";
			colorProgram = createProgram(gl, colorVs, colorFs, "Scene color");
			colorPositionLoc = gl.getAttribLocation(colorProgram, "position");
			colorModelLoc = gl.getUniformLocation(colorProgram, "model");
			colorViewLoc = gl.getUniformLocation(colorProgram, "view");
			colorProjLoc = gl.getUniformLocation(colorProgram, "proj");
			colorUniformLoc = gl.getUniformLocation(colorProgram, "color");
			const litColorVs = "attribute vec3 position;attribute vec3 normal;uniform mat4 model;uniform mat4 view;uniform mat4 proj;varying vec3 vNormal;void main(){vNormal=mat3(model)*normal;gl_Position=proj*view*model*vec4(position,1.0);}";
			const litColorFs = "precision mediump float;uniform vec4 color;uniform vec3 ambientColor;uniform float ambientStrength;uniform vec3 lightDirections[" + options.maxSceneLights + "];uniform vec3 lightColors[" + options.maxSceneLights + "];uniform float lightStrengths[" + options.maxSceneLights + "];varying vec3 vNormal;void main(){vec3 n=normalize(vNormal);vec3 lightAccum=ambientColor*ambientStrength;for(int i=0;i<" + options.maxSceneLights + ";i+=1){if(lightStrengths[i]>0.0){float diffuse=max(dot(n,normalize(lightDirections[i])),0.0);lightAccum+=lightColors[i]*(diffuse*lightStrengths[i]);}}gl_FragColor=vec4(color.rgb*min(lightAccum,vec3(1.9)),color.a);}";
			litColorProgram = createProgram(gl, litColorVs, litColorFs, "Scene lit color");
			litColorPositionLoc = gl.getAttribLocation(litColorProgram, "position");
			litColorNormalLoc = gl.getAttribLocation(litColorProgram, "normal");
			litColorModelLoc = gl.getUniformLocation(litColorProgram, "model");
			litColorViewLoc = gl.getUniformLocation(litColorProgram, "view");
			litColorProjLoc = gl.getUniformLocation(litColorProgram, "proj");
			litColorUniformLoc = gl.getUniformLocation(litColorProgram, "color");
			litColorLightingUniforms = options.getLightingUniformLocations ? options.getLightingUniformLocations(gl, litColorProgram) : null;
			const texVs = "attribute vec3 position;attribute vec2 uv;uniform mat4 model;uniform mat4 view;uniform mat4 proj;varying vec2 vUv;void main(){vUv=uv;gl_Position=proj*view*model*vec4(position,1.0);}";
			const texFs = "precision mediump float;uniform sampler2D tex;varying vec2 vUv;void main(){gl_FragColor=texture2D(tex,vUv);}";
			texProgram = createProgram(gl, texVs, texFs, "Scene texture");
			texPositionLoc = gl.getAttribLocation(texProgram, "position");
			texUvLoc = gl.getAttribLocation(texProgram, "uv");
			texModelLoc = gl.getUniformLocation(texProgram, "model");
			texViewLoc = gl.getUniformLocation(texProgram, "view");
			texProjLoc = gl.getUniformLocation(texProgram, "proj");
			texSamplerLoc = gl.getUniformLocation(texProgram, "tex");
			passthroughOverlayRenderer = createPassthroughOverlayRenderer();
			passthroughOverlayRenderer.init(gl);
			punchRenderer = createPunchRenderer();
			punchRenderer.init(gl);
			processedDepthRenderer = createProcessedDepthRenderer();
			processedDepthRenderer.init();
			worldMaskCompositeRenderer = createWorldMaskCompositeRenderer();
			worldMaskCompositeRenderer.init();
			geometry = createSceneGeometry(gl);
			menuTexture = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, menuTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.enable(gl.BLEND);
			gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.enable(gl.DEPTH_TEST);
			gl.enable(gl.CULL_FACE);
			return gl;
		},
		renderPreviewFrame: function(args) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.clearColor(args.passthroughFallbackBool ? 0 : 0.01, args.passthroughFallbackBool ? 0 : 0.01, args.passthroughFallbackBool ? 0 : 0.08, 1);
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			currentView.set(createViewMatrixFromYawPitch(args.desktopMovementState.origin.x, args.desktopMovementState.origin.y + args.desktopMovementState.eyeHeightMeters, args.desktopMovementState.origin.z, args.desktopMovementState.lookYaw, args.desktopMovementState.lookPitch));
			currentProj.set(perspectiveMatrix(Math.PI / 3, canvas.width / canvas.height, 0.05, 100));
			currentPassthroughView.set(currentView);
			currentPassthroughProj.set(currentProj);
			args.passthroughViewMatrix = currentPassthroughView;
			args.passthroughProjMatrix = currentPassthroughProj;
			args.rawPassthroughDepthInfo = null;
			args.processedDepthInfo = null;
			args.processedDepthFrameKind = "";
			args.processedDepthProfile = null;
			args.outputFramebuffer = null;
			args.targetViewport = {x: 0, y: 0, width: canvas.width, height: canvas.height};
			if (args.visualizerEngine) {
				args.visualizerEngine.setPreviewView(currentView, currentProj);
				args.visualizerEngine.update(args.previewTimeSeconds);
			}
			renderScene(args);
		},
		renderXrViews: function(args) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, args.baseLayer.framebuffer);
			if (args.transparentBackgroundBool) {
				gl.clearColor(0, 0, 0, 0);
			} else {
				gl.clearColor(args.passthroughFallbackBool ? 0 : 0.01, args.passthroughFallbackBool ? 0 : 0.01, args.passthroughFallbackBool ? 0 : 0.08, 1);
			}
			gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
			for (let i = 0; i < args.pose.views.length; i += 1) {
				const view = args.pose.views[i];
				const viewport = args.baseLayer.getViewport(view);
				gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
				const eye = getAdjustedEyePosition(view, args.pose, args.eyeDistanceMeters);
				invertRigidViewMatrix(adjustedView, view.transform.matrix, eye.x, eye.y, eye.z);
				currentView.set(adjustedView);
				currentProj.set(view.projectionMatrix);
				if (args.passthroughPose && args.passthroughPose.views && args.passthroughPose.views[i]) {
					const passthroughView = args.passthroughPose.views[i];
					invertRigidViewMatrix(
						currentPassthroughView,
						passthroughView.transform.matrix,
						passthroughView.transform.position.x,
						passthroughView.transform.position.y,
						passthroughView.transform.position.z
					);
					currentPassthroughProj.set(passthroughView.projectionMatrix);
				} else {
					currentPassthroughView.set(currentView);
					currentPassthroughProj.set(currentProj);
				}
				args.passthroughViewMatrix = currentPassthroughView;
				args.passthroughProjMatrix = currentPassthroughProj;
				args.rawPassthroughDepthInfo = args.passthroughDepthInfoByView && args.passthroughDepthInfoByView[i] ? args.passthroughDepthInfoByView[i] : null;
				args.outputFramebuffer = args.baseLayer.framebuffer;
				args.targetViewport = viewport;
				const depthProcessingConfig = args.passthroughController && args.passthroughController.getDepthProcessingConfig ? args.passthroughController.getDepthProcessingConfig() : null;
				args.processedDepthInfo = processedDepthRenderer && args.rawPassthroughDepthInfo && depthProcessingConfig ? processedDepthRenderer.process({
					viewIndex: i,
					viewport: viewport,
					depthInfo: args.rawPassthroughDepthInfo,
					depthFrameKind: args.depthFrameKind || "",
					depthProfile: args.depthProfile,
					processingConfig: depthProcessingConfig,
					outputFramebuffer: args.baseLayer.framebuffer
				}) : null;
				args.processedDepthFrameKind = args.processedDepthInfo ? "gpu-texture" : "";
				args.processedDepthProfile = args.processedDepthInfo ? {linearScale: args.processedDepthInfo.rawValueToMeters || 16, nearZ: 0} : null;
				gl.bindFramebuffer(gl.FRAMEBUFFER, args.baseLayer.framebuffer);
				gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
				if (args.visualizerEngine) {
					args.visualizerEngine.setRenderView(currentView, currentProj);
				}
				renderScene(args);
			}
		}
	};
};
