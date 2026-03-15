(function() {
	// Loads simple GLB scene props and renders them with the shared scene-lighting pipeline.
	window.createGlbAssetManager = function(deps) {
		const gl = deps.gl;
		const createProgram = deps.createProgram;
		const identityMatrix = deps.identityMatrix;
		const multiplyMatrices = deps.multiplyMatrices;
		const translateRotateYScale = deps.translateRotateYScale;
		const setStatus = deps.setStatus;
		const getLightingState = deps.getLightingState;
		const getSceneLightingUniformLocations = deps.getSceneLightingUniformLocations;
		const applySceneLightingUniforms = deps.applySceneLightingUniforms;
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
			if (window.createImageBitmap) {
				return window.createImageBitmap(blob);
			}
			return new Promise(function(resolve, reject) {
				const image = new Image();
				const imageUrl = URL.createObjectURL(blob);
				image.onload = function() {
					URL.revokeObjectURL(imageUrl);
					resolve(image);
				};
				image.onerror = function() {
					URL.revokeObjectURL(imageUrl);
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
				translateRotateYScale(
					config.position.x,
					config.position.y,
					config.position.z,
					config.rotationY || 0,
					config.scale,
					config.scale,
					config.scale
				),
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
				litProgram = createProgram(litVs, litFs);
				litPositionLoc = gl.getAttribLocation(litProgram, "position");
				litNormalLoc = gl.getAttribLocation(litProgram, "normal");
				litUvLoc = gl.getAttribLocation(litProgram, "uv");
				litModelLoc = gl.getUniformLocation(litProgram, "model");
				litViewLoc = gl.getUniformLocation(litProgram, "view");
				litProjLoc = gl.getUniformLocation(litProgram, "proj");
				litSamplerLoc = gl.getUniformLocation(litProgram, "tex");
				litLightingUniforms = getSceneLightingUniformLocations ? getSceneLightingUniformLocations(gl, litProgram) : null;
				if (!gl.getExtension("OES_element_index_uint")) {
					throw new Error("WebGL uint32 index extension missing.");
				}
			},
			loadAsset: async function(config) {
				const response = await fetch(config.url, {mode: "cors"});
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
				const jsonText = new TextDecoder("utf-8").decode(new Uint8Array(arrayBuffer, 20, jsonChunkLength));
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
				const imageBlob = new Blob([bytes.slice(imageStart, imageEnd)], {type: imageDef.mimeType || "image/png"});
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
					collisionBox: config.collisionBool === false ? null : createCollisionBox({
						min: json.accessors[primitive.attributes.POSITION].min,
						max: json.accessors[primitive.attributes.POSITION].max
					}, worldMatrix)
				});
			},
			loadAssets: async function(configs) {
				for (let i = 0; i < configs.length; i += 1) {
					try {
						await this.loadAsset(configs[i]);
					} catch (error) {
						setStatus(error.message || "glb load failed");
					}
				}
			},
			draw: function(currentView, currentProj) {
				if (!assets.length) {
					return;
				}
				gl.useProgram(litProgram);
				if (applySceneLightingUniforms && litLightingUniforms && getLightingState) {
					applySceneLightingUniforms(gl, litLightingUniforms, getLightingState());
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
})();
