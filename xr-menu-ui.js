(function() {
	// Renders the mirrored VR menu and keeps its hit zones in one place.
	const utils = window.xrVisualizerUtils;
	const clampNumber = utils.clampNumber;
	const hslToRgb = utils.hslToRgb;

	window.createXrMenuUi = function(options) {
		options = options || {};
		const emptyModeNames = ["No mode"];
		const emptyPresetNames = ["No preset"];
		const documentRef = options.documentRef || document;
		const previewParentElement = options.previewParentElement || options.parentElement || documentRef.body;
		const applyStyles = function(element, styleMap) {
			if (!styleMap) {
				return;
			}
			const styleKeys = Object.keys(styleMap);
			for (let i = 0; i < styleKeys.length; i += 1) {
				element.style[styleKeys[i]] = styleMap[styleKeys[i]];
			}
		};
		const menuCanvas = documentRef.createElement("canvas");
		menuCanvas.width = options.canvasWidth || 1280;
		menuCanvas.height = options.canvasHeight || 960;
		const menuCtx = menuCanvas.getContext("2d");
		const previewCanvas = documentRef.createElement("canvas");
		const previewCtx = previewCanvas.getContext("2d");
		const previewWidthPixels = options.desktopMenuPreviewWidthPixels || 420;
		previewCanvas.width = menuCanvas.width;
		previewCanvas.height = menuCanvas.height;
		applyStyles(previewCanvas, {
			position: "fixed",
			right: "12px",
			top: "12px",
			width: previewWidthPixels + "px",
			height: Math.round(previewWidthPixels * menuCanvas.height / menuCanvas.width) + "px",
			border: "1px solid #ffff00",
			backgroundColor: "rgba(0, 0, 32, 0.92)",
			display: "block",
			pointerEvents: "auto",
			cursor: "pointer",
			zIndex: "20"
		});
		applyStyles(previewCanvas, options.previewStyle);
		previewParentElement.appendChild(previewCanvas);

		// Layout metrics drive both drawing and interaction so the menu stays in sync.
		const getLayoutMetrics = function() {
			const audioBarItems = 5;
			const innerFrameInset = 24;
			const audioPanelTop = 108;
			const audioBarTop = 116;
			const audioBarSpacing = 12;
			const audioPanelHeight = (audioBarTop - audioPanelTop) + (audioBarItems - 1) * audioBarSpacing + 18;
			const sectionGap = 12;
			const jumpPanelTop = audioPanelTop + audioPanelHeight + sectionGap;
			const jumpPanelHeight = 164;
			const jumpPanelTitleY = jumpPanelTop + 14;
			const jumpButtonTop = jumpPanelTop + 54;
			const jumpButtonHeight = 70;
			const groundPanelTop = jumpPanelTop + jumpPanelHeight + sectionGap;
			const groundPanelHeight = 160;
			const groundTitleY = groundPanelTop + 22;
			const floorTrackY = groundPanelTop + 76;
			const eyePanelTop = groundPanelTop + groundPanelHeight + sectionGap;
			const eyePanelHeight = 156;
			const eyeTitleY = eyePanelTop + 22;
			const eyeTrackY = eyePanelTop + 76;
			const modePanelTop = eyePanelTop + eyePanelHeight + sectionGap;
			const modePanelHeight = 132;
			const modeTitleY = modePanelTop + 26;
			const modeRowTop = modePanelTop + 38;
			const modeRowHeight = 78;
			const modeArrowButtonTop = modeRowTop - 10;
			const modeArrowButtonHeight = modeRowHeight + 10;
			const modeValueY = modePanelTop + 58;
			const modeMetaY = modePanelTop + 86;
			const lightPanelTop = modePanelTop + modePanelHeight + sectionGap;
			const lightPanelHeight = 132;
			const lightTitleY = lightPanelTop + 26;
			const lightRowTop = lightPanelTop + 38;
			const lightRowHeight = 78;
			const lightArrowButtonTop = lightRowTop - 10;
			const lightArrowButtonHeight = lightRowHeight + 10;
			const lightValueY = lightPanelTop + 58;
			const lightMetaY = lightPanelTop + 86;
			const presetPanelTop = lightPanelTop + lightPanelHeight + sectionGap;
			const presetPanelHeight = 132;
			const presetTitleY = presetPanelTop + 26;
			const presetRowTop = presetPanelTop + 38;
			const presetRowHeight = 78;
			const presetArrowButtonTop = presetRowTop - 10;
			const presetArrowButtonHeight = presetRowHeight + 10;
			const presetValueY = presetPanelTop + 58;
			const presetMetaY = presetPanelTop + 86;
			const prevX = menuCanvas.width * options.presetPrevMinU;
			const prevWidth = menuCanvas.width * (options.presetPrevMaxU - options.presetPrevMinU);
			const nextX = menuCanvas.width * options.presetNextMinU;
			const nextWidth = menuCanvas.width * (options.presetNextMaxU - options.presetNextMinU);
			const centerX = menuCanvas.width * 0.5;
			const trackStartX = menuCanvas.width * options.menuSliderMinU;
			const trackEndX = menuCanvas.width * options.menuSliderMaxU;
			const canvasHeight = Math.ceil(presetPanelTop + presetPanelHeight + 30 + sectionGap);
			const contentInset = canvasHeight - innerFrameInset - (presetPanelTop + presetPanelHeight);
			const contentLeft = innerFrameInset + contentInset;
			const contentRight = menuCanvas.width - innerFrameInset - contentInset;
			return {
				contentLeft: contentLeft,
				contentWidth: contentRight - contentLeft,
				contentRight: contentRight,
				canvasHeight: canvasHeight,
				audioPanelTop: audioPanelTop,
				audioBarTop: audioBarTop,
				audioBarSpacing: audioBarSpacing,
				audioPanelHeight: audioPanelHeight,
				jumpPanelTop: jumpPanelTop,
				jumpPanelHeight: jumpPanelHeight,
				jumpPanelTitleY: jumpPanelTitleY,
				jumpButtonTop: jumpButtonTop,
				jumpButtonHeight: jumpButtonHeight,
				groundPanelTop: groundPanelTop,
				groundPanelHeight: groundPanelHeight,
				groundTitleY: groundTitleY,
				floorTrackY: floorTrackY,
				eyePanelTop: eyePanelTop,
				eyePanelHeight: eyePanelHeight,
				eyeTitleY: eyeTitleY,
				eyeTrackY: eyeTrackY,
				modePanelTop: modePanelTop,
				modePanelHeight: modePanelHeight,
				modeTitleY: modeTitleY,
				modeRowTop: modeRowTop,
				modeRowHeight: modeRowHeight,
				modeArrowButtonTop: modeArrowButtonTop,
				modeArrowButtonHeight: modeArrowButtonHeight,
				modeValueY: modeValueY,
				modeMetaY: modeMetaY,
				lightPanelTop: lightPanelTop,
				lightPanelHeight: lightPanelHeight,
				lightTitleY: lightTitleY,
				lightRowTop: lightRowTop,
				lightRowHeight: lightRowHeight,
				lightArrowButtonTop: lightArrowButtonTop,
				lightArrowButtonHeight: lightArrowButtonHeight,
				lightValueY: lightValueY,
				lightMetaY: lightMetaY,
				presetPanelTop: presetPanelTop,
				presetPanelHeight: presetPanelHeight,
				presetTitleY: presetTitleY,
				presetRowTop: presetRowTop,
				presetRowHeight: presetRowHeight,
				presetArrowButtonTop: presetArrowButtonTop,
				presetArrowButtonHeight: presetArrowButtonHeight,
				presetValueY: presetValueY,
				presetMetaY: presetMetaY,
				prevX: prevX,
				prevWidth: prevWidth,
				nextX: nextX,
				nextWidth: nextWidth,
				centerX: centerX,
				trackStartX: trackStartX,
				trackEndX: trackEndX,
				sliderHalfHeightPx: options.menuSliderHalfHeight * canvasHeight
			};
		};

		// Keep the desktop mirror aspect ratio aligned with the live menu canvas.
		const syncCanvasSize = function(layout) {
			const targetHeight = layout.canvasHeight;
			if (menuCanvas.height !== targetHeight) {
				menuCanvas.height = targetHeight;
			}
			if (previewCanvas.width !== menuCanvas.width || previewCanvas.height !== targetHeight) {
				previewCanvas.width = menuCanvas.width;
				previewCanvas.height = targetHeight;
			}
			previewCanvas.style.width = previewWidthPixels + "px";
			previewCanvas.style.height = Math.round(previewWidthPixels * targetHeight / menuCanvas.width) + "px";
		};

		// Shrinks long labels until they fit the fixed card widths.
		const drawCenteredFittedText = function(text, centerX, topY, maxWidth, fontSize, minFontSize, color, weight) {
			let currentFontSize = fontSize;
			while (currentFontSize > minFontSize) {
				menuCtx.font = (weight || "") + " " + currentFontSize + "px Arial";
				if (menuCtx.measureText(text).width <= maxWidth) {
					break;
				}
				currentFontSize -= 2;
			}
			menuCtx.fillStyle = color;
			menuCtx.fillText(text, centerX, topY);
		};

		const getNonEmptyItems = function(items, fallbackItems) {
			return items && items.length ? items : fallbackItems;
		};

		return {
			menuCanvas: menuCanvas,
			previewCanvas: previewCanvas,
			getPlaneHeight: function(menuWidth) {
				return menuWidth * (getLayoutMetrics().canvasHeight / menuCanvas.width);
			},
			getInteractionAtUv: function(u, v) {
				const layout = getLayoutMetrics();
				const x = u * menuCanvas.width;
				const y = v * layout.canvasHeight;
				const floorAlphaSliderBool = Math.abs(y - layout.floorTrackY) <= layout.sliderHalfHeightPx && x >= layout.trackStartX && x <= layout.trackEndX;
				const eyeDistanceSliderBool = Math.abs(y - layout.eyeTrackY) <= layout.sliderHalfHeightPx && x >= layout.trackStartX && x <= layout.trackEndX;
				let jumpMode = "";
				let shaderModeAction = "";
				let lightPresetAction = "";
				let presetAction = "";
				if (y >= layout.jumpButtonTop && y <= layout.jumpButtonTop + layout.jumpButtonHeight) {
					if (u >= options.jumpModeDoubleMinU && u <= options.jumpModeDoubleMaxU) {
						jumpMode = "double";
					} else if (u >= options.jumpModeMultiMinU && u <= options.jumpModeMultiMaxU) {
						jumpMode = "multi";
					}
				}
				if (y >= layout.modeArrowButtonTop && y <= layout.modeArrowButtonTop + layout.modeArrowButtonHeight) {
					if (x >= layout.prevX && x <= layout.prevX + layout.prevWidth) {
						shaderModeAction = "prev";
					} else if (x >= layout.nextX && x <= layout.nextX + layout.nextWidth) {
						shaderModeAction = "next";
					}
				}
				if (y >= layout.lightArrowButtonTop && y <= layout.lightArrowButtonTop + layout.lightArrowButtonHeight) {
					if (x >= layout.prevX && x <= layout.prevX + layout.prevWidth) {
						lightPresetAction = "prev";
					} else if (x >= layout.nextX && x <= layout.nextX + layout.nextWidth) {
						lightPresetAction = "next";
					}
				}
				if (y >= layout.presetArrowButtonTop && y <= layout.presetArrowButtonTop + layout.presetArrowButtonHeight) {
					if (x >= layout.prevX && x <= layout.prevX + layout.prevWidth) {
						presetAction = "prev";
					} else if (x >= layout.nextX && x <= layout.nextX + layout.nextWidth) {
						presetAction = "next";
					}
				}
				return {
					floorAlphaSliderBool: floorAlphaSliderBool,
					eyeDistanceSliderBool: eyeDistanceSliderBool,
					jumpMode: jumpMode,
					shaderModeAction: shaderModeAction,
					lightPresetAction: lightPresetAction,
					presetAction: presetAction
				};
			},
			render: function(renderState) {
				renderState = renderState || {};
				const layout = getLayoutMetrics();
				const audioMetrics = renderState.audioMetrics || {};
				const shaderModeNames = getNonEmptyItems(renderState.shaderModeNames, emptyModeNames);
				const currentShaderModeIndex = clampNumber(renderState.currentShaderModeIndex || 0, 0, shaderModeNames.length - 1);
				const lightPresetNames = getNonEmptyItems(renderState.lightPresetNames, emptyPresetNames);
				const currentLightPresetIndex = clampNumber(renderState.currentLightPresetIndex || 0, 0, lightPresetNames.length - 1);
				const presetNames = getNonEmptyItems(renderState.presetNames, emptyPresetNames);
				const currentPresetIndex = clampNumber(renderState.currentPresetIndex || 0, 0, presetNames.length - 1);
				const accentRgb = hslToRgb((renderState.sceneTimeSeconds || 0) * 0.03 + 0.04, 0.85, 0.62);
				const accentColor = "rgb(" + Math.round(accentRgb[0] * 255) + "," + Math.round(accentRgb[1] * 255) + "," + Math.round(accentRgb[2] * 255) + ")";
				const accentSoft = "rgba(" + Math.round(accentRgb[0] * 255) + "," + Math.round(accentRgb[1] * 255) + "," + Math.round(accentRgb[2] * 255) + ",0.18)";
				const audioBarItems = [
					{label: "Level", value: clampNumber(audioMetrics.level || 0, 0, 1)},
					{label: "Peak", value: clampNumber(audioMetrics.peak || 0, 0, 1)},
					{label: "Bass", value: clampNumber(audioMetrics.bass || 0, 0, 1)},
					{label: "Transient", value: clampNumber(audioMetrics.transient || 0, 0, 1)},
					{label: "Beat", value: clampNumber(audioMetrics.beatPulse || 0, 0, 1)}
				];
				syncCanvasSize(layout);
				const headerGradient = menuCtx.createLinearGradient(0, 0, menuCanvas.width, menuCanvas.height);
				headerGradient.addColorStop(0, "#04111f");
				headerGradient.addColorStop(0.55, "#071d33");
				headerGradient.addColorStop(1, "#160c2f");
				menuCtx.fillStyle = headerGradient;
				menuCtx.fillRect(0, 0, menuCanvas.width, menuCanvas.height);
				menuCtx.fillStyle = "rgba(255,255,255,0.025)";
				for (let i = 0; i < 24; i += 1) {
					menuCtx.fillRect((i * 73 + (renderState.sceneTimeSeconds || 0) * 28) % (menuCanvas.width + 40) - 40, 0, 18, menuCanvas.height);
				}
				menuCtx.fillStyle = accentSoft;
				menuCtx.beginPath();
				menuCtx.arc(menuCanvas.width * 0.18, menuCanvas.height * 0.14, 160, 0, Math.PI * 2);
				menuCtx.fill();
				menuCtx.beginPath();
				menuCtx.arc(menuCanvas.width * 0.84, menuCanvas.height * 0.24, 210, 0, Math.PI * 2);
				menuCtx.fill();
				menuCtx.strokeStyle = "rgba(255,255,255,0.18)";
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(14, 14, menuCanvas.width - 28, menuCanvas.height - 28);
				menuCtx.strokeStyle = accentColor;
				menuCtx.lineWidth = 4;
				menuCtx.strokeRect(24, 24, menuCanvas.width - 48, menuCanvas.height - 48);
				menuCtx.textAlign = "left";
				menuCtx.textBaseline = "top";
				menuCtx.fillStyle = "#f8fbff";
				menuCtx.font = "bold 46px Arial";
				menuCtx.fillText("VR Control Deck", layout.contentLeft, 34);
				menuCtx.fillStyle = accentSoft;
				menuCtx.fillRect(layout.contentLeft, layout.audioPanelTop, layout.contentWidth, layout.audioPanelHeight);
				menuCtx.strokeStyle = "rgba(255,255,255,0.18)";
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(layout.contentLeft, layout.audioPanelTop, layout.contentWidth, layout.audioPanelHeight);
				const audioBarStartX = layout.contentLeft + 150;
				const audioBarWidth = layout.contentWidth - 230;
				for (let i = 0; i < audioBarItems.length; i += 1) {
					const item = audioBarItems[i];
					const rowY = layout.audioBarTop + i * layout.audioBarSpacing;
					menuCtx.textAlign = "left";
					menuCtx.fillStyle = "#ffffff";
					menuCtx.font = "bold 15px Arial";
					menuCtx.fillText(item.label, layout.contentLeft + 18, rowY);
					menuCtx.fillStyle = "rgba(255,255,255,0.14)";
					menuCtx.fillRect(audioBarStartX, rowY + 2, audioBarWidth, 7);
					menuCtx.fillStyle = accentColor;
					menuCtx.fillRect(audioBarStartX, rowY + 2, audioBarWidth * item.value, 7);
					menuCtx.strokeStyle = "rgba(255,255,255,0.18)";
					menuCtx.lineWidth = 1;
					menuCtx.strokeRect(audioBarStartX, rowY + 2, audioBarWidth, 7);
					menuCtx.textAlign = "right";
					menuCtx.fillStyle = accentColor;
					menuCtx.fillText(Math.round(item.value * 100) + "%", layout.contentRight - 16, rowY);
				}
				menuCtx.textAlign = "left";
				menuCtx.fillStyle = "rgba(6,14,24,0.78)";
				menuCtx.fillRect(layout.contentLeft, layout.jumpPanelTop, layout.contentWidth, layout.jumpPanelHeight);
				menuCtx.strokeStyle = "rgba(255,255,255,0.15)";
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(layout.contentLeft, layout.jumpPanelTop, layout.contentWidth, layout.jumpPanelHeight);
				menuCtx.textAlign = "center";
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 34px Arial";
				menuCtx.fillText("Jump Mode", menuCanvas.width * 0.5, layout.jumpPanelTitleY);
				const doubleButtonX = menuCanvas.width * options.jumpModeDoubleMinU;
				const doubleButtonWidth = menuCanvas.width * (options.jumpModeDoubleMaxU - options.jumpModeDoubleMinU);
				const multiButtonX = menuCanvas.width * options.jumpModeMultiMinU;
				const multiButtonWidth = menuCanvas.width * (options.jumpModeMultiMaxU - options.jumpModeMultiMinU);
				menuCtx.fillStyle = renderState.jumpMode === "double" ? accentSoft : renderState.hoveredJumpMode === "double" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)";
				menuCtx.fillRect(doubleButtonX, layout.jumpButtonTop, doubleButtonWidth, layout.jumpButtonHeight);
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(doubleButtonX, layout.jumpButtonTop, doubleButtonWidth, layout.jumpButtonHeight);
				menuCtx.fillStyle = renderState.jumpMode === "multi" ? accentSoft : renderState.hoveredJumpMode === "multi" ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)";
				menuCtx.fillRect(multiButtonX, layout.jumpButtonTop, multiButtonWidth, layout.jumpButtonHeight);
				menuCtx.strokeRect(multiButtonX, layout.jumpButtonTop, multiButtonWidth, layout.jumpButtonHeight);
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 30px Arial";
				menuCtx.fillText("Double", doubleButtonX + doubleButtonWidth * 0.5, layout.jumpButtonTop + 16);
				menuCtx.fillText("Multi", multiButtonX + multiButtonWidth * 0.5, layout.jumpButtonTop + 16);
				menuCtx.fillStyle = "rgba(255,255,255,0.7)";
				menuCtx.font = "20px Arial";
				menuCtx.fillText("2 jumps total", doubleButtonX + doubleButtonWidth * 0.5, layout.jumpButtonTop + 48);
				menuCtx.fillText("Unlimited jumps", multiButtonX + multiButtonWidth * 0.5, layout.jumpButtonTop + 48);
				menuCtx.textAlign = "left";
				menuCtx.fillStyle = "rgba(6,14,24,0.82)";
				menuCtx.fillRect(layout.contentLeft, layout.groundPanelTop, layout.contentWidth, layout.groundPanelHeight);
				menuCtx.strokeStyle = "rgba(255,255,255,0.15)";
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(layout.contentLeft, layout.groundPanelTop, layout.contentWidth, layout.groundPanelHeight);
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 30px Arial";
				menuCtx.fillText("Ground Opacity", layout.contentLeft + 28, layout.groundTitleY);
				menuCtx.textAlign = "right";
				menuCtx.fillStyle = accentColor;
				menuCtx.fillText(Math.round((renderState.floorAlpha || 0) * 100) + "%", layout.contentRight - 28, layout.groundTitleY);
				menuCtx.textAlign = "left";
				const floorKnobX = menuCanvas.width * renderState.floorAlphaSliderU;
				menuCtx.strokeStyle = "rgba(255,255,255,0.14)";
				menuCtx.lineWidth = 18;
				menuCtx.beginPath();
				menuCtx.moveTo(layout.trackStartX, layout.floorTrackY);
				menuCtx.lineTo(layout.trackEndX, layout.floorTrackY);
				menuCtx.stroke();
				const floorGradient = menuCtx.createLinearGradient(layout.trackStartX, layout.floorTrackY, layout.trackEndX, layout.floorTrackY);
				for (let i = 0; i <= 6; i += 1) {
					const stopColor = hslToRgb(i / 6, 0.88, 0.6);
					floorGradient.addColorStop(i / 6, "rgb(" + Math.round(stopColor[0] * 255) + "," + Math.round(stopColor[1] * 255) + "," + Math.round(stopColor[2] * 255) + ")");
				}
				menuCtx.strokeStyle = floorGradient;
				menuCtx.lineWidth = 10;
				menuCtx.beginPath();
				menuCtx.moveTo(layout.trackStartX, layout.floorTrackY);
				menuCtx.lineTo(layout.trackEndX, layout.floorTrackY);
				menuCtx.stroke();
				menuCtx.fillStyle = renderState.floorAlphaHoverBool || renderState.floorAlphaSliderActiveBool ? accentColor : "#ffffff";
				menuCtx.beginPath();
				menuCtx.arc(floorKnobX, layout.floorTrackY, 22, 0, Math.PI * 2);
				menuCtx.fill();
				menuCtx.fillStyle = "rgba(255,255,255,0.65)";
				menuCtx.font = "18px Arial";
				menuCtx.textAlign = "left";
				menuCtx.fillText("Invisible", layout.trackStartX, layout.floorTrackY + 26);
				menuCtx.textAlign = "right";
				menuCtx.fillText("Solid", layout.trackEndX, layout.floorTrackY + 26);
				menuCtx.textAlign = "left";
				menuCtx.fillStyle = "rgba(6,14,24,0.82)";
				menuCtx.fillRect(layout.contentLeft, layout.eyePanelTop, layout.contentWidth, layout.eyePanelHeight);
				menuCtx.strokeStyle = "rgba(255,255,255,0.15)";
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(layout.contentLeft, layout.eyePanelTop, layout.contentWidth, layout.eyePanelHeight);
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 30px Arial";
				menuCtx.fillText("Eye Distance", layout.contentLeft + 28, layout.eyeTitleY);
				menuCtx.textAlign = "right";
				menuCtx.fillStyle = accentColor;
				menuCtx.fillText(Math.round((renderState.eyeDistanceMeters || 0) * 1000) + " mm", layout.contentRight - 28, layout.eyeTitleY);
				menuCtx.textAlign = "left";
				const eyeKnobX = menuCanvas.width * renderState.eyeDistanceSliderU;
				menuCtx.strokeStyle = "rgba(255,255,255,0.14)";
				menuCtx.lineWidth = 18;
				menuCtx.beginPath();
				menuCtx.moveTo(layout.trackStartX, layout.eyeTrackY);
				menuCtx.lineTo(layout.trackEndX, layout.eyeTrackY);
				menuCtx.stroke();
				menuCtx.strokeStyle = accentColor;
				menuCtx.lineWidth = 10;
				menuCtx.beginPath();
				menuCtx.moveTo(layout.trackStartX, layout.eyeTrackY);
				menuCtx.lineTo(layout.trackEndX, layout.eyeTrackY);
				menuCtx.stroke();
				menuCtx.fillStyle = renderState.eyeDistanceHoverBool || renderState.eyeDistanceSliderActiveBool ? accentColor : "#ffffff";
				menuCtx.beginPath();
				menuCtx.arc(eyeKnobX, layout.eyeTrackY, 22, 0, Math.PI * 2);
				menuCtx.fill();
				menuCtx.fillStyle = "rgba(255,255,255,0.65)";
				menuCtx.font = "18px Arial";
				menuCtx.textAlign = "left";
				menuCtx.fillText(Math.round(renderState.eyeDistanceMin * 1000) + " mm", layout.trackStartX, layout.eyeTrackY + 26);
				menuCtx.textAlign = "right";
				menuCtx.fillText(Math.round(renderState.eyeDistanceMax * 1000) + " mm", layout.trackEndX, layout.eyeTrackY + 26);
				menuCtx.textAlign = "center";
				menuCtx.fillStyle = "rgba(6,14,24,0.82)";
				menuCtx.fillRect(layout.contentLeft, layout.modePanelTop, layout.contentWidth, layout.modePanelHeight);
				menuCtx.strokeStyle = "rgba(255,255,255,0.15)";
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(layout.contentLeft, layout.modePanelTop, layout.contentWidth, layout.modePanelHeight);
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 28px Arial";
				menuCtx.fillText("Visualizer Mode", menuCanvas.width * 0.5, layout.modeTitleY);
				menuCtx.fillStyle = renderState.hoveredShaderModeAction === "prev" ? accentSoft : "rgba(255,255,255,0.06)";
				menuCtx.fillRect(layout.prevX, layout.modeArrowButtonTop, layout.prevWidth, layout.modeArrowButtonHeight);
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(layout.prevX, layout.modeArrowButtonTop, layout.prevWidth, layout.modeArrowButtonHeight);
				menuCtx.fillStyle = renderState.hoveredShaderModeAction === "next" ? accentSoft : "rgba(255,255,255,0.06)";
				menuCtx.fillRect(layout.nextX, layout.modeArrowButtonTop, layout.nextWidth, layout.modeArrowButtonHeight);
				menuCtx.strokeRect(layout.nextX, layout.modeArrowButtonTop, layout.nextWidth, layout.modeArrowButtonHeight);
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 44px Arial";
				menuCtx.fillText("<", layout.prevX + layout.prevWidth * 0.5, layout.modeRowTop + 14);
				menuCtx.fillText(">", layout.nextX + layout.nextWidth * 0.5, layout.modeRowTop + 14);
				drawCenteredFittedText(shaderModeNames[currentShaderModeIndex], layout.centerX, layout.modeValueY, menuCanvas.width * 0.42, 28, 18, "#ffffff", "bold");
				menuCtx.fillStyle = "rgba(255,255,255,0.65)";
				menuCtx.font = "18px Arial";
				menuCtx.fillText((currentShaderModeIndex + 1) + " / " + shaderModeNames.length, layout.centerX, layout.modeMetaY);
				menuCtx.fillStyle = "rgba(6,14,24,0.82)";
				menuCtx.fillRect(layout.contentLeft, layout.lightPanelTop, layout.contentWidth, layout.lightPanelHeight);
				menuCtx.strokeStyle = "rgba(255,255,255,0.15)";
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(layout.contentLeft, layout.lightPanelTop, layout.contentWidth, layout.lightPanelHeight);
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 28px Arial";
				menuCtx.fillText("Light Preset", menuCanvas.width * 0.5, layout.lightTitleY);
				menuCtx.fillStyle = renderState.hoveredLightPresetAction === "prev" ? accentSoft : "rgba(255,255,255,0.06)";
				menuCtx.fillRect(layout.prevX, layout.lightArrowButtonTop, layout.prevWidth, layout.lightArrowButtonHeight);
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(layout.prevX, layout.lightArrowButtonTop, layout.prevWidth, layout.lightArrowButtonHeight);
				menuCtx.fillStyle = renderState.hoveredLightPresetAction === "next" ? accentSoft : "rgba(255,255,255,0.06)";
				menuCtx.fillRect(layout.nextX, layout.lightArrowButtonTop, layout.nextWidth, layout.lightArrowButtonHeight);
				menuCtx.strokeRect(layout.nextX, layout.lightArrowButtonTop, layout.nextWidth, layout.lightArrowButtonHeight);
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 44px Arial";
				menuCtx.fillText("<", layout.prevX + layout.prevWidth * 0.5, layout.lightRowTop + 14);
				menuCtx.fillText(">", layout.nextX + layout.nextWidth * 0.5, layout.lightRowTop + 14);
				drawCenteredFittedText(lightPresetNames[currentLightPresetIndex], layout.centerX, layout.lightValueY, menuCanvas.width * 0.42, 28, 18, "#ffffff", "bold");
				menuCtx.fillStyle = "rgba(255,255,255,0.65)";
				menuCtx.font = "18px Arial";
				drawCenteredFittedText(renderState.currentLightPresetDescription || "", layout.centerX, layout.lightMetaY, menuCanvas.width * 0.56, 18, 14, "rgba(255,255,255,0.65)");
				menuCtx.fillStyle = "rgba(6,14,24,0.82)";
				menuCtx.fillRect(layout.contentLeft, layout.presetPanelTop, layout.contentWidth, layout.presetPanelHeight);
				menuCtx.strokeStyle = "rgba(255,255,255,0.15)";
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(layout.contentLeft, layout.presetPanelTop, layout.contentWidth, layout.presetPanelHeight);
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 28px Arial";
				menuCtx.fillText("Butterchurn Preset", menuCanvas.width * 0.5, layout.presetTitleY);
				menuCtx.fillStyle = renderState.hoveredPresetAction === "prev" ? accentSoft : "rgba(255,255,255,0.06)";
				menuCtx.fillRect(layout.prevX, layout.presetArrowButtonTop, layout.prevWidth, layout.presetArrowButtonHeight);
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(layout.prevX, layout.presetArrowButtonTop, layout.prevWidth, layout.presetArrowButtonHeight);
				menuCtx.fillStyle = renderState.hoveredPresetAction === "next" ? accentSoft : "rgba(255,255,255,0.06)";
				menuCtx.fillRect(layout.nextX, layout.presetArrowButtonTop, layout.nextWidth, layout.presetArrowButtonHeight);
				menuCtx.strokeRect(layout.nextX, layout.presetArrowButtonTop, layout.nextWidth, layout.presetArrowButtonHeight);
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 44px Arial";
				menuCtx.fillText("<", layout.prevX + layout.prevWidth * 0.5, layout.presetRowTop + 14);
				menuCtx.fillText(">", layout.nextX + layout.nextWidth * 0.5, layout.presetRowTop + 14);
				drawCenteredFittedText(presetNames[currentPresetIndex], layout.centerX, layout.presetValueY, menuCanvas.width * 0.42, 28, 18, "#ffffff", "bold");
				menuCtx.fillStyle = "rgba(255,255,255,0.65)";
				menuCtx.font = "18px Arial";
				menuCtx.fillText((currentPresetIndex + 1) + " / " + presetNames.length, layout.centerX, layout.presetMetaY);
				return menuCanvas;
			},
			updateDesktopPreview: function(previewState) {
				previewState = previewState || {};
				if (!previewState.visibleBool) {
					previewCanvas.style.display = "none";
					return;
				}
				this.render(previewState.renderState);
				previewCanvas.style.display = "block";
				previewCanvas.style.pointerEvents = previewState.interactiveBool ? "auto" : "none";
				previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
				previewCtx.drawImage(menuCanvas, 0, 0);
			}
		};
	};
})();
