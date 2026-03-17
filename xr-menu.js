// app/menu.js
const createMenuView = function(options) {
	options = options || {};
	const emptyModeNames = ["No mode"];
	const emptyPresetNames = ["No preset"];
	const documentRef = options.documentRef || document;
	const previewParentElement = options.previewParentElement || options.parentElement || documentRef.body;
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
		display: options.initialDesktopPreviewVisibleBool === false ? "none" : "block",
		pointerEvents: "auto",
		cursor: "pointer",
		zIndex: "20"
	});
	applyStyles(previewCanvas, options.previewStyle);
	previewParentElement.appendChild(previewCanvas);
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
			return {floorAlphaSliderBool, eyeDistanceSliderBool, jumpMode, shaderModeAction, lightPresetAction, presetAction};
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
			const drawNavigablePanel = function(panelOpts) {
				menuCtx.textAlign = "center";
				menuCtx.fillStyle = "rgba(6,14,24,0.82)";
				menuCtx.fillRect(layout.contentLeft, panelOpts.panelTop, layout.contentWidth, panelOpts.panelHeight);
				menuCtx.strokeStyle = "rgba(255,255,255,0.15)";
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(layout.contentLeft, panelOpts.panelTop, layout.contentWidth, panelOpts.panelHeight);
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 28px Arial";
				menuCtx.fillText(panelOpts.title, menuCanvas.width * 0.5, panelOpts.titleY);
				menuCtx.fillStyle = panelOpts.hoveredAction === "prev" ? accentSoft : "rgba(255,255,255,0.06)";
				menuCtx.fillRect(layout.prevX, panelOpts.arrowButtonTop, layout.prevWidth, panelOpts.arrowButtonHeight);
				menuCtx.lineWidth = 2;
				menuCtx.strokeRect(layout.prevX, panelOpts.arrowButtonTop, layout.prevWidth, panelOpts.arrowButtonHeight);
				menuCtx.fillStyle = panelOpts.hoveredAction === "next" ? accentSoft : "rgba(255,255,255,0.06)";
				menuCtx.fillRect(layout.nextX, panelOpts.arrowButtonTop, layout.nextWidth, panelOpts.arrowButtonHeight);
				menuCtx.strokeRect(layout.nextX, panelOpts.arrowButtonTop, layout.nextWidth, panelOpts.arrowButtonHeight);
				menuCtx.fillStyle = "#ffffff";
				menuCtx.font = "bold 44px Arial";
				menuCtx.fillText("<", layout.prevX + layout.prevWidth * 0.5, panelOpts.rowTop + 14);
				menuCtx.fillText(">", layout.nextX + layout.nextWidth * 0.5, panelOpts.rowTop + 14);
				drawCenteredFittedText(panelOpts.valueText, layout.centerX, panelOpts.valueY, menuCanvas.width * 0.42, 28, 18, "#ffffff", "bold");
				if (panelOpts.metaFitted) {
					drawCenteredFittedText(panelOpts.metaText, layout.centerX, panelOpts.metaY, menuCanvas.width * 0.56, 18, 14, "rgba(255,255,255,0.65)");
				} else {
					menuCtx.fillStyle = "rgba(255,255,255,0.65)";
					menuCtx.font = "18px Arial";
					menuCtx.fillText(panelOpts.metaText, layout.centerX, panelOpts.metaY);
				}
			};
			drawNavigablePanel({panelTop: layout.modePanelTop, panelHeight: layout.modePanelHeight, title: "Visualizer Mode", titleY: layout.modeTitleY, hoveredAction: renderState.hoveredShaderModeAction, arrowButtonTop: layout.modeArrowButtonTop, arrowButtonHeight: layout.modeArrowButtonHeight, rowTop: layout.modeRowTop, valueText: shaderModeNames[currentShaderModeIndex], valueY: layout.modeValueY, metaText: (currentShaderModeIndex + 1) + " / " + shaderModeNames.length, metaY: layout.modeMetaY});
			drawNavigablePanel({panelTop: layout.lightPanelTop, panelHeight: layout.lightPanelHeight, title: "Light Preset", titleY: layout.lightTitleY, hoveredAction: renderState.hoveredLightPresetAction, arrowButtonTop: layout.lightArrowButtonTop, arrowButtonHeight: layout.lightArrowButtonHeight, rowTop: layout.lightRowTop, valueText: lightPresetNames[currentLightPresetIndex], valueY: layout.lightValueY, metaText: renderState.currentLightPresetDescription || "", metaY: layout.lightMetaY, metaFitted: true});
			drawNavigablePanel({panelTop: layout.presetPanelTop, panelHeight: layout.presetPanelHeight, title: "Butterchurn Preset", titleY: layout.presetTitleY, hoveredAction: renderState.hoveredPresetAction, arrowButtonTop: layout.presetArrowButtonTop, arrowButtonHeight: layout.presetArrowButtonHeight, rowTop: layout.presetRowTop, valueText: presetNames[currentPresetIndex], valueY: layout.presetValueY, metaText: (currentPresetIndex + 1) + " / " + presetNames.length, metaY: layout.presetMetaY});
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

// core/menu-controller.js
const createMenuController = function(options) {
	const menuView = options.menuView;
	const menuCanvas = menuView.menuCanvas;
	const previewCanvas = menuView.previewCanvas;
	const controllerRays = [];
	const triggerPressedByHand = new Map();
	const state = {
		jumpMode: options.initialJumpMode || "double",
		menuOpenBool: false,
		menuTogglePressedBool: false,
		floorAlpha: options.initialFloorAlpha == null ? 0.72 : options.initialFloorAlpha,
		eyeDistanceMeters: options.initialEyeDistanceMeters == null ? 0.064 : options.initialEyeDistanceMeters,
		activeSliderHand: "",
		activeFloorAlphaSliderHand: "",
		eyeDistanceHoverBool: false,
		floorAlphaHoverBool: false,
		hoveredJumpMode: "",
		hoveredShaderModeAction: "",
		hoveredLightPresetAction: "",
		hoveredPresetAction: "",
		desktopPreviewVisibleBool: options.initialDesktopPreviewVisibleBool !== false,
		desktopPointerActiveBool: false,
		desktopPointerU: 0,
		desktopPointerV: 0,
		desktopPreviewEventsRegisteredBool: false
	};
	const menuPlane = {
		center: {x: 0, y: 1.45, z: -0.8},
		right: {x: 1, y: 0, z: 0},
		up: {x: 0, y: 1, z: 0},
		normal: {x: 0, y: 0, z: 1}
	};
	const createSliderMapping = function(minValue, maxValue) {
		return {
			toSliderU: function(value) {
				return options.menuSliderMinU + (clampNumber(value, minValue, maxValue) - minValue) / (maxValue - minValue) * (options.menuSliderMaxU - options.menuSliderMinU);
			},
			fromSliderU: function(u) {
				return minValue + clampNumber((u - options.menuSliderMinU) / (options.menuSliderMaxU - options.menuSliderMinU), 0, 1) * (maxValue - minValue);
			}
		};
	};
	const eyeDistanceSlider = createSliderMapping(options.eyeDistanceMin, options.eyeDistanceMax);
	const floorAlphaSlider = createSliderMapping(options.floorAlphaMin, options.floorAlphaMax);
	const clearHoverState = function() {
		state.eyeDistanceHoverBool = false;
		state.floorAlphaHoverBool = false;
		state.hoveredJumpMode = "";
		state.hoveredShaderModeAction = "";
		state.hoveredLightPresetAction = "";
		state.hoveredPresetAction = "";
	};
	const releaseSliderHand = function(hand) {
		if (state.activeSliderHand === hand) {
			state.activeSliderHand = "";
		}
		if (state.activeFloorAlphaSliderHand === hand) {
			state.activeFloorAlphaSliderHand = "";
		}
	};
	const applyDesktopHoverState = function(pointerLockedBool, xrSessionActiveBool) {
		if (xrSessionActiveBool || !state.desktopPreviewVisibleBool || pointerLockedBool || !state.desktopPointerActiveBool) {
			state.eyeDistanceHoverBool = state.activeSliderHand === "desktop";
			state.floorAlphaHoverBool = state.activeFloorAlphaSliderHand === "desktop";
			state.hoveredJumpMode = "";
			state.hoveredShaderModeAction = "";
			state.hoveredLightPresetAction = "";
			state.hoveredPresetAction = "";
			return;
		}
		const hit = menuView.getInteractionAtUv(state.desktopPointerU, state.desktopPointerV);
		state.eyeDistanceHoverBool = !!hit.eyeDistanceSliderBool || state.activeSliderHand === "desktop";
		state.floorAlphaHoverBool = !!hit.floorAlphaSliderBool || state.activeFloorAlphaSliderHand === "desktop";
		state.hoveredJumpMode = hit.jumpMode || "";
		state.hoveredShaderModeAction = hit.shaderModeAction || "";
		state.hoveredLightPresetAction = hit.lightPresetAction || "";
		state.hoveredPresetAction = hit.presetAction || "";
		if (state.activeSliderHand === "desktop") {
			state.eyeDistanceMeters = eyeDistanceSlider.fromSliderU(state.desktopPointerU);
		}
		if (state.activeFloorAlphaSliderHand === "desktop") {
			state.floorAlpha = floorAlphaSlider.fromSliderU(state.desktopPointerU);
		}
	};
	const intersectMenu = function(ray) {
		if (!state.menuOpenBool) {
			return null;
		}
		const menuPlaneHeight = menuView.getPlaneHeight(options.menuWidth);
		const denom = dotVec3(menuPlane.normal.x, menuPlane.normal.y, menuPlane.normal.z, ray.dir.x, ray.dir.y, ray.dir.z);
		if (Math.abs(denom) < 0.0001) {
			return null;
		}
		const distance = dotVec3(menuPlane.center.x - ray.origin.x, menuPlane.center.y - ray.origin.y, menuPlane.center.z - ray.origin.z, menuPlane.normal.x, menuPlane.normal.y, menuPlane.normal.z) / denom;
		if (distance <= 0 || distance > options.rayLength) {
			return null;
		}
		const point = {x: ray.origin.x + ray.dir.x * distance, y: ray.origin.y + ray.dir.y * distance, z: ray.origin.z + ray.dir.z * distance};
		const relX = point.x - menuPlane.center.x;
		const relY = point.y - menuPlane.center.y;
		const relZ = point.z - menuPlane.center.z;
		const localX = dotVec3(relX, relY, relZ, menuPlane.right.x, menuPlane.right.y, menuPlane.right.z);
		const localY = dotVec3(relX, relY, relZ, menuPlane.up.x, menuPlane.up.y, menuPlane.up.z);
		if (Math.abs(localX) > options.menuWidth * 0.5 || Math.abs(localY) > menuPlaneHeight * 0.5) {
			return null;
		}
		const u = 0.5 + localX / options.menuWidth;
		const v = 0.5 - localY / menuPlaneHeight;
		return Object.assign({distance: distance, point: point, u: u, v: v}, menuView.getInteractionAtUv(u, v));
	};
	const updateControllerRays = function(frame, xrSession, xrRefSpace) {
		controllerRays.length = 0;
		clearHoverState();
		if (!xrSession || !xrRefSpace) {
			return;
		}
		const sources = xrSession.inputSources || [];
		for (let i = 0; i < sources.length; i += 1) {
			const source = sources[i];
			if (!source || source.targetRayMode !== "tracked-pointer") {
				continue;
			}
			const pose = frame.getPose(source.targetRaySpace, xrRefSpace);
			if (!pose) {
				continue;
			}
			const ray = {
				hand: source.handedness || "none",
				source: source,
				origin: {x: pose.transform.position.x, y: pose.transform.position.y, z: pose.transform.position.z},
				dir: extractForwardDirectionFromQuaternion(pose.transform.orientation),
				length: options.rayLength,
				hitBool: false,
				hitPoint: null,
				hit: null
			};
			const hit = intersectMenu(ray);
			if (hit) {
				ray.length = hit.distance;
				ray.hitBool = true;
				ray.hitPoint = hit.point;
				ray.hit = hit;
				state.eyeDistanceHoverBool = hit.eyeDistanceSliderBool || state.eyeDistanceHoverBool;
				state.floorAlphaHoverBool = hit.floorAlphaSliderBool || state.floorAlphaHoverBool;
				state.hoveredJumpMode = hit.jumpMode || state.hoveredJumpMode;
				state.hoveredShaderModeAction = hit.shaderModeAction || state.hoveredShaderModeAction;
				state.hoveredLightPresetAction = hit.lightPresetAction || state.hoveredLightPresetAction;
				state.hoveredPresetAction = hit.presetAction || state.hoveredPresetAction;
			}
			controllerRays.push(ray);
		}
	};
	return {
		getState: function() {
			return {jumpMode: state.jumpMode, menuOpenBool: state.menuOpenBool, floorAlpha: state.floorAlpha, eyeDistanceMeters: state.eyeDistanceMeters, desktopPreviewVisibleBool: state.desktopPreviewVisibleBool, plane: menuPlane, planeHeight: menuView.getPlaneHeight(options.menuWidth)};
		},
		getControllerRays: function() {
			return controllerRays;
		},
		getRenderState: function(externalState) {
			externalState = externalState || {};
			return {
				sceneTimeSeconds: externalState.sceneTimeSeconds,
				audioMetrics: externalState.audioMetrics,
				jumpMode: state.jumpMode,
				hoveredJumpMode: state.hoveredJumpMode,
				hoveredShaderModeAction: state.hoveredShaderModeAction,
				hoveredLightPresetAction: state.hoveredLightPresetAction,
				hoveredPresetAction: state.hoveredPresetAction,
				floorAlpha: state.floorAlpha,
				eyeDistanceMeters: state.eyeDistanceMeters,
				floorAlphaHoverBool: state.floorAlphaHoverBool,
				eyeDistanceHoverBool: state.eyeDistanceHoverBool,
				floorAlphaSliderActiveBool: !!state.activeFloorAlphaSliderHand,
				eyeDistanceSliderActiveBool: !!state.activeSliderHand,
				shaderModeNames: externalState.shaderModeNames,
				currentShaderModeIndex: externalState.currentShaderModeIndex,
				lightPresetNames: externalState.lightPresetNames,
				currentLightPresetIndex: externalState.currentLightPresetIndex,
				currentLightPresetDescription: externalState.currentLightPresetDescription,
				presetNames: externalState.presetNames,
				currentPresetIndex: externalState.currentPresetIndex,
				eyeDistanceMin: options.eyeDistanceMin,
				eyeDistanceMax: options.eyeDistanceMax,
				eyeDistanceSliderU: eyeDistanceSlider.toSliderU(state.eyeDistanceMeters),
				floorAlphaSliderU: floorAlphaSlider.toSliderU(state.floorAlpha)
			};
		},
		updateMenuPose: function(pose) {
			if (!pose) {
				return;
			}
			const matrix = pose.transform.matrix;
			const forward = normalizeVec3(-matrix[8], 0, -matrix[10]);
			menuPlane.normal.x = -forward.x;
			menuPlane.normal.y = 0;
			menuPlane.normal.z = -forward.z;
			menuPlane.right.x = menuPlane.normal.z;
			menuPlane.right.y = 0;
			menuPlane.right.z = -menuPlane.normal.x;
			menuPlane.up.x = 0;
			menuPlane.up.y = 1;
			menuPlane.up.z = 0;
			menuPlane.center.x = matrix[12] + forward.x * 0.8;
			menuPlane.center.y = matrix[13] - 0.03;
			menuPlane.center.z = matrix[14] + forward.z * 0.8;
		},
		renderTexture: function(gl, menuTexture, externalState) {
			menuView.render(this.getRenderState(externalState));
			gl.bindTexture(gl.TEXTURE_2D, menuTexture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, menuCanvas);
		},
		updateDesktopPreview: function(args) {
			args = args || {};
			applyDesktopHoverState(args.pointerLockedBool, args.xrSessionActiveBool);
			menuView.updateDesktopPreview({visibleBool: state.desktopPreviewVisibleBool, interactiveBool: !!args.interactiveBool, renderState: this.getRenderState(args.renderState)});
		},
		updateDesktopPointerFromEvent: function(event) {
			const rect = previewCanvas.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) {
				return null;
			}
			state.desktopPointerU = clampNumber((event.clientX - rect.left) / rect.width, 0, 1);
			state.desktopPointerV = clampNumber((event.clientY - rect.top) / rect.height, 0, 1);
			state.desktopPointerActiveBool = true;
			return menuView.getInteractionAtUv(state.desktopPointerU, state.desktopPointerV);
		},
		registerDesktopPreviewEvents: function(args) {
			args = args || {};
			if (state.desktopPreviewEventsRegisteredBool) {
				return;
			}
			const controller = this;
			const callbacks = args.callbacks || {};
			const getInteractionState = args.getInteractionState || function() { return {}; };
			previewCanvas.addEventListener("mousemove", function(event) {
				controller.handleDesktopPointerMove(event, getInteractionState());
			});
			previewCanvas.addEventListener("mouseleave", function() {
				controller.handleDesktopPointerLeave();
			});
			previewCanvas.addEventListener("mousedown", function(event) {
				if (controller.handleDesktopPointerDown(event, callbacks, getInteractionState())) {
					event.preventDefault();
				}
			});
			state.desktopPreviewEventsRegisteredBool = true;
		},
		handleDesktopPointerMove: function(event, args) {
			args = args || {};
			if (args.xrSessionActiveBool || args.pointerLockedBool || !state.desktopPreviewVisibleBool) {
				return null;
			}
			return this.updateDesktopPointerFromEvent(event);
		},
		handleDesktopPointerLeave: function() {
			if (state.activeSliderHand === "desktop" || state.activeFloorAlphaSliderHand === "desktop") {
				return;
			}
			this.clearDesktopPointerState();
		},
		handleDesktopPointerDown: function(event, callbacks, args) {
			args = args || {};
			callbacks = callbacks || {};
			if (args.xrSessionActiveBool || args.pointerLockedBool || !state.desktopPreviewVisibleBool) {
				return false;
			}
			const hit = this.updateDesktopPointerFromEvent(event);
			if (!hit) {
				return false;
			}
			if (hit.jumpMode) {
				state.jumpMode = hit.jumpMode;
			}
			if (hit.shaderModeAction && callbacks.onShaderModeAction) {
				callbacks.onShaderModeAction(hit.shaderModeAction === "prev" ? -1 : 1);
			}
			if (hit.lightPresetAction && callbacks.onLightPresetAction) {
				callbacks.onLightPresetAction(hit.lightPresetAction === "prev" ? -1 : 1);
			}
			if (hit.presetAction && callbacks.onPresetAction) {
				callbacks.onPresetAction(hit.presetAction === "prev" ? -1 : 1);
			}
			if (hit.eyeDistanceSliderBool) {
				state.activeSliderHand = "desktop";
				state.eyeDistanceMeters = eyeDistanceSlider.fromSliderU(state.desktopPointerU);
			}
			if (hit.floorAlphaSliderBool) {
				state.activeFloorAlphaSliderHand = "desktop";
				state.floorAlpha = floorAlphaSlider.fromSliderU(state.desktopPointerU);
			}
			return true;
		},
		handleDesktopPointerUp: function() {
			releaseSliderHand("desktop");
		},
		clearDesktopPointerState: function() {
			state.desktopPointerActiveBool = false;
			state.desktopPointerU = 0;
			state.desktopPointerV = 0;
			clearHoverState();
			releaseSliderHand("desktop");
		},
		setDesktopPreviewVisibleBool: function(visibleBool) {
			state.desktopPreviewVisibleBool = !!visibleBool;
			if (!state.desktopPreviewVisibleBool) {
				this.clearDesktopPointerState();
				previewCanvas.style.display = "none";
				return;
			}
			previewCanvas.style.display = "block";
		},
		resetSessionState: function() {
			state.menuOpenBool = false;
			state.menuTogglePressedBool = false;
			state.activeSliderHand = "";
			state.activeFloorAlphaSliderHand = "";
			clearHoverState();
			controllerRays.length = 0;
			triggerPressedByHand.clear();
		},
		endSession: function() {
			state.menuOpenBool = false;
			state.menuTogglePressedBool = false;
			state.activeSliderHand = "";
			state.activeFloorAlphaSliderHand = "";
			clearHoverState();
			controllerRays.length = 0;
			triggerPressedByHand.clear();
		},
		updateXrInput: function(args) {
			args = args || {};
			const callbacks = args.callbacks || {};
			const sources = args.xrSession ? args.xrSession.inputSources || [] : [];
			let togglePressedBool = false;
			for (let i = 0; i < sources.length; i += 1) {
				const source = sources[i];
				if (source.handedness === "left" && source.gamepad && source.gamepad.buttons[5] && source.gamepad.buttons[5].pressed) {
					togglePressedBool = true;
				}
			}
			if (togglePressedBool && !state.menuTogglePressedBool) {
				state.menuOpenBool = !state.menuOpenBool;
				state.activeSliderHand = "";
				state.activeFloorAlphaSliderHand = "";
				if (state.menuOpenBool) {
					this.updateMenuPose(args.pose);
				}
			}
			state.menuTogglePressedBool = togglePressedBool;
			updateControllerRays(args.frame, args.xrSession, args.xrRefSpace);
			for (let i = 0; i < controllerRays.length; i += 1) {
				const ray = controllerRays[i];
				const gamepad = ray.source.gamepad;
				const hand = ray.hand;
				const triggerPressedBool = !!(gamepad && gamepad.buttons[0] && gamepad.buttons[0].pressed);
				const wasTriggerPressedBool = triggerPressedByHand.get(hand) || false;
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.jumpMode) {
					state.jumpMode = ray.hit.jumpMode;
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.shaderModeAction && callbacks.onShaderModeAction) {
					callbacks.onShaderModeAction(ray.hit.shaderModeAction === "prev" ? -1 : 1);
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.lightPresetAction && callbacks.onLightPresetAction) {
					callbacks.onLightPresetAction(ray.hit.lightPresetAction === "prev" ? -1 : 1);
				}
				if (triggerPressedBool && !wasTriggerPressedBool && ray.hit && ray.hit.presetAction && callbacks.onPresetAction) {
					callbacks.onPresetAction(ray.hit.presetAction === "prev" ? -1 : 1);
				}
				if (triggerPressedBool && ray.hit && ray.hit.eyeDistanceSliderBool && (!wasTriggerPressedBool || state.activeSliderHand === hand)) {
					state.activeSliderHand = hand;
					state.eyeDistanceMeters = eyeDistanceSlider.fromSliderU(ray.hit.u);
				}
				if (triggerPressedBool && ray.hit && ray.hit.floorAlphaSliderBool && (!wasTriggerPressedBool || state.activeFloorAlphaSliderHand === hand)) {
					state.activeFloorAlphaSliderHand = hand;
					state.floorAlpha = floorAlphaSlider.fromSliderU(ray.hit.u);
				}
				if (!triggerPressedBool && wasTriggerPressedBool) {
					releaseSliderHand(hand);
				}
				triggerPressedByHand.set(hand, triggerPressedBool);
			}
		}
	};
};
