(function() {
	// Owns WebGL setup and the shared scene draw pipeline for XR and desktop preview.
	window.createXrSceneRenderer = function(options) {
		const canvas = options.canvas;
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
		let floorBuffer = null;
		let floorNormalBuffer = null;
		let menuBuffer = null;
		let menuUvBuffer = null;
		let lineBuffer = null;
		let gridBuffer = null;
		let gridVertexCount = 0;
		let boxBuffer = null;
		let boxNormalBuffer = null;
		let menuTexture = null;
		const currentView = new Float32Array(16);
		const currentProj = new Float32Array(16);
		const adjustedView = new Float32Array(16);
		const colorVec4 = new Float32Array(4);

		const createShader = function(type, source) {
			const shader = gl.createShader(type);
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				throw new Error(gl.getShaderInfoLog(shader) || "Shader compile failed");
			}
			return shader;
		};

		const createProgram = function(vsSource, fsSource) {
			const program = gl.createProgram();
			gl.attachShader(program, createShader(gl.VERTEX_SHADER, vsSource));
			gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fsSource));
			gl.linkProgram(program);
			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
				throw new Error(gl.getProgramInfoLog(program) || "Program link failed");
			}
			return program;
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
				return {x: eye.x, y: eye.y, z: eye.z};
			}
			const scale = (eyeDistanceMeters * 0.5) / offsetLength;
			return {
				x: center.x + offsetX * scale,
				y: center.y + offsetY * scale,
				z: center.z + offsetZ * scale
			};
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
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
			if (options.applySceneLightingUniforms && litColorLightingUniforms && sceneLighting) {
				options.applySceneLightingUniforms(gl, litColorLightingUniforms, sceneLighting.getState());
			}
			gl.drawArrays(mode, 0, count);
		};

		const drawTexturedPlane = function(model) {
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
			gl.useProgram(texProgram);
			gl.bindBuffer(gl.ARRAY_BUFFER, menuBuffer);
			gl.enableVertexAttribArray(texPositionLoc);
			gl.vertexAttribPointer(texPositionLoc, 3, gl.FLOAT, false, 0, 0);
			gl.bindBuffer(gl.ARRAY_BUFFER, menuUvBuffer);
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
			gl.disable(gl.CULL_FACE);
			drawLitColor(floorBuffer, floorNormalBuffer, 6, gl.TRIANGLES, options.translateScale(0, -0.01, 0, options.floorHalfSize, 1, options.floorHalfSize), reactiveColors.floor, sceneLighting);
			drawColor(gridBuffer, gridVertexCount, gl.LINES, options.identityMatrix(), reactiveColors.grid);
			for (let i = 0; i < options.levelBoxes.length; i += 1) {
				const box = options.levelBoxes[i];
				const pulse = options.clampNumber(reactiveColors.audioLevel * 0.4 + reactiveColors.beatPulse * 0.75 + reactiveColors.transient * 1.8, 0, 1);
				drawLitColor(
					boxBuffer,
					boxNormalBuffer,
					36,
					gl.TRIANGLES,
					options.translateScale(box.x, box.y, box.z, box.width, box.height, box.depth),
					[
						options.clampNumber(box.color[0] + pulse * 0.25, 0, 1),
						options.clampNumber(box.color[1] + pulse * 0.25, 0, 1),
						options.clampNumber(box.color[2] + pulse * 0.25, 0, 1),
						options.clampNumber(box.color[3] + reactiveColors.beatPulse * 0.12, 0.2, 0.95)
					],
					sceneLighting
				);
			}
			gl.enable(gl.CULL_FACE);
		};

		const drawOverlayLine = function(start, end, pointBool, color) {
			const data = pointBool ? [start.x, start.y, start.z] : [start.x, start.y, start.z, end.x, end.y, end.z];
			gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
			drawColor(lineBuffer, pointBool ? 1 : 2, pointBool ? gl.POINTS : gl.LINES, options.identityMatrix(), color);
		};

		// The scene order stays centralized here so preview and XR use the same draw sequence.
		const renderScene = function(args) {
			const menuState = args.menuController.getState();
			if (args.visualizerManager) {
				args.visualizerManager.drawPreScene();
			}
			if (menuState.floorAlpha > 0.001) {
				drawFloor(args.sceneLighting, args.getReactiveFloorColors());
			}
			if (args.glbAssetManager) {
				args.glbAssetManager.draw(currentView, currentProj);
			}
			if (args.visualizerManager) {
				args.visualizerManager.drawWorld();
			}
			if (menuState.menuOpenBool) {
				args.menuController.renderTexture(gl, menuTexture, args.menuContentState);
				gl.disable(gl.DEPTH_TEST);
				gl.disable(gl.CULL_FACE);
				drawTexturedPlane(options.basisScale(menuState.plane.center.x, menuState.plane.center.y, menuState.plane.center.z, menuState.plane.right, menuState.plane.up, menuState.plane.normal, options.menuWidth, menuState.planeHeight, 1));
				gl.enable(gl.CULL_FACE);
				gl.enable(gl.DEPTH_TEST);
			}
			const controllerRays = args.menuController.getControllerRays();
			for (let i = 0; i < controllerRays.length; i += 1) {
				const ray = controllerRays[i];
				const end = {
					x: ray.origin.x + ray.dir.x * ray.length,
					y: ray.origin.y + ray.dir.y * ray.length,
					z: ray.origin.z + ray.dir.z * ray.length
				};
				drawOverlayLine(ray.origin, end, false, ray.hitBool ? [1, 0.95, 0.2, 0.95] : [1, 0.2, 0.2, 0.9]);
				if (ray.hitPoint) {
					drawOverlayLine(ray.hitPoint, null, true, [0.2, 1, 0.2, 1]);
				}
			}
			if (args.visualizerManager) {
				args.visualizerManager.drawPostScene();
			}
		};

		return {
			createProgram: createProgram,
			init: function() {
				gl = canvas.getContext("webgl", {xrCompatible: true, antialias: true, alpha: false});
				if (!gl) {
					options.onInitFailure();
					return false;
				}
				const colorVs = "attribute vec3 position;uniform mat4 model;uniform mat4 view;uniform mat4 proj;void main(){gl_Position=proj*view*model*vec4(position,1.0);}";
				const colorFs = "precision mediump float;uniform vec4 color;void main(){gl_FragColor=color;}";
				colorProgram = createProgram(colorVs, colorFs);
				colorPositionLoc = gl.getAttribLocation(colorProgram, "position");
				colorModelLoc = gl.getUniformLocation(colorProgram, "model");
				colorViewLoc = gl.getUniformLocation(colorProgram, "view");
				colorProjLoc = gl.getUniformLocation(colorProgram, "proj");
				colorUniformLoc = gl.getUniformLocation(colorProgram, "color");
				const litColorVs = "attribute vec3 position;attribute vec3 normal;uniform mat4 model;uniform mat4 view;uniform mat4 proj;varying vec3 vNormal;void main(){vNormal=mat3(model)*normal;gl_Position=proj*view*model*vec4(position,1.0);}";
				const litColorFs = "precision mediump float;uniform vec4 color;uniform vec3 ambientColor;uniform float ambientStrength;uniform vec3 lightDirections[" + options.maxSceneLights + "];uniform vec3 lightColors[" + options.maxSceneLights + "];uniform float lightStrengths[" + options.maxSceneLights + "];varying vec3 vNormal;void main(){vec3 n=normalize(vNormal);vec3 lightAccum=ambientColor*ambientStrength;for(int i=0;i<" + options.maxSceneLights + ";i+=1){if(lightStrengths[i]>0.0){float diffuse=max(dot(n,normalize(lightDirections[i])),0.0);lightAccum+=lightColors[i]*(diffuse*lightStrengths[i]);}}gl_FragColor=vec4(color.rgb*min(lightAccum,vec3(1.9)),color.a);}";
				litColorProgram = createProgram(litColorVs, litColorFs);
				litColorPositionLoc = gl.getAttribLocation(litColorProgram, "position");
				litColorNormalLoc = gl.getAttribLocation(litColorProgram, "normal");
				litColorModelLoc = gl.getUniformLocation(litColorProgram, "model");
				litColorViewLoc = gl.getUniformLocation(litColorProgram, "view");
				litColorProjLoc = gl.getUniformLocation(litColorProgram, "proj");
				litColorUniformLoc = gl.getUniformLocation(litColorProgram, "color");
				litColorLightingUniforms = options.getSceneLightingUniformLocations ? options.getSceneLightingUniformLocations(gl, litColorProgram) : null;
				const texVs = "attribute vec3 position;attribute vec2 uv;uniform mat4 model;uniform mat4 view;uniform mat4 proj;varying vec2 vUv;void main(){vUv=uv;gl_Position=proj*view*model*vec4(position,1.0);}";
				const texFs = "precision mediump float;uniform sampler2D tex;varying vec2 vUv;void main(){gl_FragColor=texture2D(tex,vUv);}";
				texProgram = createProgram(texVs, texFs);
				texPositionLoc = gl.getAttribLocation(texProgram, "position");
				texUvLoc = gl.getAttribLocation(texProgram, "uv");
				texModelLoc = gl.getUniformLocation(texProgram, "model");
				texViewLoc = gl.getUniformLocation(texProgram, "view");
				texProjLoc = gl.getUniformLocation(texProgram, "proj");
				texSamplerLoc = gl.getUniformLocation(texProgram, "tex");
				floorBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, floorBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, 0, -1, 1, 0, -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0, 1]), gl.STATIC_DRAW);
				floorNormalBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, floorNormalBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]), gl.STATIC_DRAW);
				const gridData = [];
				for (let i = -20; i <= 20; i += 1) {
					gridData.push(i, 0, -20, i, 0, 20);
					gridData.push(-20, 0, i, 20, 0, i);
				}
				gridVertexCount = gridData.length / 3;
				gridBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gridData), gl.STATIC_DRAW);
				boxBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, boxBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
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
				]), gl.STATIC_DRAW);
				boxNormalBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, boxNormalBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
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
				]), gl.STATIC_DRAW);
				menuBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, menuBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0]), gl.STATIC_DRAW);
				menuUvBuffer = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, menuUvBuffer);
				gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0]), gl.STATIC_DRAW);
				lineBuffer = gl.createBuffer();
				menuTexture = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, menuTexture);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				gl.enable(gl.BLEND);
				gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
				gl.enable(gl.DEPTH_TEST);
				gl.enable(gl.CULL_FACE);
				return gl;
			},
			renderPreviewFrame: function(args) {
				// The shell owns viewport pixel sizing so the renderer can stay focused on drawing only.
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				gl.viewport(0, 0, canvas.width, canvas.height);
				gl.clearColor(0.01, 0.01, 0.08, 1);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
				currentView.set(createViewMatrixFromYawPitch(
					args.desktopMovementState.origin.x,
					args.desktopMovementState.origin.y + args.desktopMovementState.eyeHeightMeters,
					args.desktopMovementState.origin.z,
					args.desktopMovementState.lookYaw,
					args.desktopMovementState.lookPitch
				));
				currentProj.set(perspectiveMatrix(Math.PI / 3, canvas.width / canvas.height, 0.05, 100));
				if (args.visualizerManager) {
					args.visualizerManager.setPreviewView(currentView, currentProj);
					args.visualizerManager.update(args.previewTimeSeconds);
				}
				renderScene(args);
			},
			renderXrViews: function(args) {
				const baseLayer = args.baseLayer;
				gl.bindFramebuffer(gl.FRAMEBUFFER, baseLayer.framebuffer);
				gl.clearColor(0.01, 0.01, 0.08, 1);
				gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
				for (let i = 0; i < args.pose.views.length; i += 1) {
					const view = args.pose.views[i];
					const viewport = baseLayer.getViewport(view);
					gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);
					const eye = getAdjustedEyePosition(view, args.pose, args.eyeDistanceMeters);
					invertRigidViewMatrix(adjustedView, view.transform.matrix, eye.x, eye.y, eye.z);
					currentView.set(adjustedView);
					currentProj.set(view.projectionMatrix);
					if (args.visualizerManager) {
						args.visualizerManager.setRenderView(currentView, currentProj);
					}
					renderScene(args);
				}
			}
		};
	};
})();
