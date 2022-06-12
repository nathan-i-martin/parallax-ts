/**
* Parallax.js
* @author Matthew Wagerfield - @wagerfield, René Roth - mail@reneroth.org
* @description Creates a parallax effect between an array of layers,
*              driving the motion from the gyroscope output of a smartdevice.
*              If no gyroscope is available, the cursor position is used.
*/

// Where are we getting this file from?
const rqAnFr = require('raf')

class helpers {
  static propertyCache: {[key: string]: string} = {};
  static vendors: string[][] = [[], ['-webkit-','webkit'], ['-moz-','Moz'], ['-o-','O'], ['-ms-','ms']];

  /**
   * Clamp a number if it is outside of the defined region
   * @param value The value to look at
   * @param min The minimum allowed value
   * @param max The maximum allowed value
   * @returns The value if it is valid. Otherwise, `min` or `max`
   */
  static clamp(value: number, min: number, max: number): number {
    const maxIsLarger = (): number => {
      if(value < min) return min;

      if(value > max) return max;

      return value;
    }
    const minIsLarger = (): number => {
      if(value < max) return max;

      if(value > min) return min;

      return value;
    }
    
    if(min < max) return maxIsLarger()
    return minIsLarger()
  }

  /**
   * Take an HTML element and capture one of the parallax attributes we want
   * @param element An HTML Element
   * @param name The suffix of the data name
   * @returns The attribute, deserialized
   * Responses from this method will have to be specifically typed using: `(Response as Type)`
   */
  static data(element: HTMLElement, name: string): any {
    let attribute: string | null = element.getAttribute('data-'+name);

    if(attribute == null) return undefined;

    return helpers.deserialize(attribute)
  }

  /**
   * Deserialize an attribute value
   * @param value A string to be deserialized
   * @returns The value after being deserialized
   */
  static deserialize(value: string): any {
    if (value === 'true')  return true
    if (value === 'false') return false
    if (value === 'null')  return null

    if (!isNaN(parseFloat(value)) && isFinite(parseFloat(value))) return parseFloat(value)

    return value
  }

  /**
   * Convert a value to be camelCase
   * @param value the value to convert
   * @returns The value as camelCase
   */
  static camelCase(value: string): string {
    return value.replace(/-+(.)?/g, (match: string, character: string) => {
      return character ? character.toUpperCase() : ''
    })
  }

  static accelerate(element: HTMLElement) {
    helpers.css(element, 'transform', 'translate3d(0,0,0) rotate(0.0001deg)')
    helpers.css(element, 'transform-style', 'preserve-3d')
    helpers.css(element, 'backface-visibility', 'hidden')
  }

  static transformSupport(value: string) {
    let element = document.createElement('div'),
        propertySupport: boolean = false,
        propertyValue: string = '',
        featureSupport: boolean = false,
        cssProperty: string = '',
        jsProperty: any = ''
    for (let i = 0, l = helpers.vendors.length; i < l; i++) {
      let vendor: string[] = helpers?.vendors[i];
      if (vendor.length) {
        cssProperty = vendor[0] + 'transform'
        jsProperty = vendor[1] + 'Transform'
      } else {
        cssProperty = 'transform'
        jsProperty = 'transform'
      }
      if (element.style[jsProperty] !== undefined) {
        propertySupport = true
        break
      }
    }
    switch(value) {
      case '2D':
        featureSupport = propertySupport
        break
      case '3D':
        if (propertySupport) {
          let body = document.body || document.createElement('body'),
              documentElement = document.documentElement,
              documentOverflow = documentElement.style.overflow,
              isCreatedBody = false

          if (!document.body) {
            isCreatedBody = true
            documentElement.style.overflow = 'hidden'
            documentElement.appendChild(body)
            body.style.overflow = 'hidden'
            body.style.background = ''
          }

          body.appendChild(element)
          element.style[jsProperty] = 'translate3d(1px,1px,1px)'
          propertyValue = window.getComputedStyle(element).getPropertyValue(cssProperty)
          featureSupport = propertyValue !== undefined && propertyValue.length > 0 && propertyValue !== 'none'
          documentElement.style.overflow = documentOverflow
          body.removeChild(element)

          if ( isCreatedBody ) {
            body.removeAttribute('style')
            
            body.parentNode?.removeChild(body)
          }
        }
        break
    }
    return featureSupport
  }

  static css(element: HTMLElement, property: string, value: string) {
    let jsProperty: any = helpers.propertyCache[property]
    if (!jsProperty) {
      for (let i = 0, l = helpers.vendors.length; i < l; i++) {
        let vendor: string[] = helpers?.vendors[i];
        if (vendor.length) {
          jsProperty = helpers.camelCase(helpers.vendors[i][1] + '-' + property)
        } else {
          jsProperty = property
        }
        if (element.style[jsProperty] !== undefined) {
          helpers.propertyCache[property] = jsProperty
          break
        }
      }
    }
    element.style[jsProperty] = value
  }

}

const MAGIC_NUMBER = 30,
      DEFAULTS = {
        relativeInput: false,
        clipRelativeInput: false,
        inputElement: null,
        hoverOnly: false,
        calibrationThreshold: 100,
        calibrationDelay: 500,
        supportDelay: 500,
        calibrateX: false,
        calibrateY: true,
        invertX: true,
        invertY: true,
        limitX: false,
        limitY: false,
        scalarX: 10.0,
        scalarY: 10.0,
        frictionX: 0.1,
        frictionY: 0.1,
        originX: 0.5,
        originY: 0.5,
        pointerEvents: false,
        precision: 1,
        onReady: null,
        selector: null
      }

export class Parallax {
  element?: HTMLElement;
  inputElement: HTMLElement;
  layers?: any[] = [];

  onReady?: Function;

  calibrationTimer?: NodeJS.Timeout;
  calibrationFlag?: boolean = true;
  calibrationThreshold?: number;

  detectionTimer?: NodeJS.Timeout;

  enabled = false;
  depthsX?: number[];
  depthsY?: number[];
  raf = null;

  bounds: DOMRect = new DOMRect();
  elementPositionX?: number;
  elementPositionY?: number;
  elementWidth?: number;
  elementHeight?: number;

  elementCenterX?: number;
  elementCenterY?: number;

  elementRangeX?: number;
  elementRangeY?: number;

  calibrationX?: number;
  calibrationY?: number;

  inputX?: number;
  inputY?: number;

  motionX?: number;
  motionY?: number;

  velocityX?: number;
  velocityY?: number;

  originX?: number;
  originY?: number;

  calibrateX?: number;
  calibrateY?: number;
  
  invertX?: number;
  invertY?: number;
  
  frictionX?: number;
  frictionY?: number;
    
  scalarX?: number;
  scalarY?: number;

  limitX?: number;
  limitY?: number;

  precision?: number;

  windowWidth?: number;
  windowHeight?: number;
  windowCenterX?: number;
  windowCenterY?: number;
  windowRadiusX?: number;
  windowRadiusY?: number;
  portrait: boolean = false;
  desktop: boolean = !navigator.userAgent.match(/(iPhone|iPod|iPad|Android|BlackBerry|BB10|mobi|tablet|opera mini|nexus 7)/i)
  motionSupport: boolean = !!window.DeviceMotionEvent && !this.desktop
  orientationSupport: boolean = !!window.DeviceOrientationEvent && !this.desktop
  orientationStatus: number = 0;
  motionStatus: number = 0;

  hoverOnly: boolean;

  transform2DSupport: boolean = false;
  transform3DSupport: boolean = false;
  supportDelay: number = 0;

  calibrationDelay: number = 0;

  selector: string = '';

  relativeInput: boolean = false;
  clipRelativeInput: boolean = false;

  pointerEvents: boolean = false;

  constructor(element: HTMLElement) {

    this.element = element

    // Because we are now dealing with different types. We must define the types individually
    // If a data attribute doesn't exist, it will simply be saved in the class as undefined, which it would have been anyways.
    this.calibrateX         = (helpers.data(this.element, 'calibrate-x'   ) as number )
    this.calibrateY         = (helpers.data(this.element, 'calibrate-y'   ) as number )
    this.invertX            = (helpers.data(this.element, 'invert-x'      ) as number )
    this.invertY            = (helpers.data(this.element, 'invert-y'      ) as number )
    this.limitX             = (helpers.data(this.element, 'limit-x'       ) as number )
    this.limitY             = (helpers.data(this.element, 'limit-y'       ) as number )
    this.scalarX            = (helpers.data(this.element, 'scalar-x'      ) as number )
    this.scalarY            = (helpers.data(this.element, 'scalar-y'      ) as number )
    this.frictionX          = (helpers.data(this.element, 'friction-x'    ) as number )
    this.frictionY          = (helpers.data(this.element, 'friction-y'    ) as number )
    this.originX            = (helpers.data(this.element, 'origin-x'      ) as number )
    this.originY            = (helpers.data(this.element, 'origin-y'      ) as number )
    this.pointerEvents      = (helpers.data(this.element, 'pointer-events') as boolean)
    this.precision          = (helpers.data(this.element, 'precision'     ) as number )
    this.relativeInput      = (helpers.data(this.element, 'relative-input') as boolean)
    this.clipRelativeInput  = (helpers.data(this.element, 'clip-relative-input') as boolean)
    this.hoverOnly          = (helpers.data(this.element, 'hover-only'    ) as boolean)
    this.inputElement       = (document.querySelector(helpers.data(this.element, 'input-element')) as HTMLElement)
    this.selector           = (helpers.data(this.element, 'selector'      ) as string )

    if(!this.inputElement) {
      this.inputElement = this.element
    }

    this.onMouseMove = this.onMouseMove.bind(this);
    this.onDeviceOrientation = this.onDeviceOrientation.bind(this);
    this.onDeviceMotion = this.onDeviceMotion.bind(this);
    this.onOrientationTimer = this.onOrientationTimer.bind(this);
    this.onMotionTimer = this.onMotionTimer.bind(this);
    this.onCalibrationTimer = this.onCalibrationTimer.bind(this);
    this.onAnimationFrame = this.onAnimationFrame.bind(this);
    this.onWindowResize = this.onWindowResize.bind(this);

    this.initialize()
  }

  /**
   * Initialize the Parallax scene
   */
  initialize(): void {
    this.transform2DSupport = helpers.transformSupport('2D');
    this.transform3DSupport = helpers.transformSupport('3D');

    if(!this.element) return console.error('There is no Parallax scene defined!');

    // Configure Context Styles
    if (this.transform3DSupport) {
      helpers.accelerate(this.element)
    }

    let style = window.getComputedStyle(this.element)
    if (style.getPropertyValue('position') === 'static') {
      if(this.element) this.element.style.position = 'relative'
    }

    // Pointer events
    if(!this.pointerEvents) this.element.style.pointerEvents = 'none'

    // Setup
    this.updateLayers()
    this.updateDimensions()
    this.enable()
    this.queueCalibration(this.calibrationDelay)
  }

  doReadyCallback(): void {
    if(this.onReady) this.onReady()
  }

  updateLayers(): void {
    if(!this.element) return console.error('There is no Parallax scene defined!');

    if(this.selector) {
      this.layers = Array.from(this.element.querySelectorAll(this.selector))
    } else {
      this.layers = Array.from(this.element.children)
    }

    if(!this.layers.length) return console.warn('ParallaxJS: Your scene does not have any layers.')

    this.depthsX = []
    this.depthsY = []

    for (let index = 0; index < this.layers.length; index++) {
      let layer = this.layers[index]

      if (this.transform3DSupport) {
        helpers.accelerate(layer)
      }

      layer.style.position = index ? 'absolute' : 'relative'
      layer.style.display = 'block'
      layer.style.left = 0
      layer.style.top = 0

      let depth: number = (helpers.data(layer, 'depth') as number) || 0
      this.depthsX.push((helpers.data(layer, 'depth-x') as number) || depth)
      this.depthsY.push((helpers.data(layer, 'depth-y') as number) || depth)
    }
  }

  updateDimensions(): void {
    if(!this.originX) return;
    if(!this.originY) return;

    this.windowWidth = window.innerWidth
    this.windowHeight = window.innerHeight
    this.windowCenterX = this.windowWidth * this.originX
    this.windowCenterY = this.windowHeight * this.originY
    this.windowRadiusX = Math.max(this.windowCenterX, this.windowWidth - this.windowCenterX)
    this.windowRadiusY = Math.max(this.windowCenterY, this.windowHeight - this.windowCenterY)
  }

  updateBounds(): void {
    if(!this.originX) return;
    if(!this.originY) return;

    this.bounds = this.inputElement.getBoundingClientRect()
    this.elementPositionX = this.bounds.left
    this.elementPositionY = this.bounds.top
    this.elementWidth = this.bounds.width
    this.elementHeight = this.bounds.height
    this.elementCenterX = this.elementWidth * this.originX
    this.elementCenterY = this.elementHeight * this.originY
    this.elementRangeX = Math.max(this.elementCenterX, this.elementWidth - this.elementCenterX)
    this.elementRangeY = Math.max(this.elementCenterY, this.elementHeight - this.elementCenterY)
  }

  queueCalibration(delay: number): void {
    clearTimeout(this.calibrationTimer)
    this.calibrationTimer = setTimeout(this.onCalibrationTimer, delay)
  }

  /**
   * Enable the Parallax scene
   */
  enable(): void {
    if (this.enabled) {
      return
    }
    this.enabled = true

    if (this.orientationSupport) {
      this.portrait = false
      window.addEventListener('deviceorientation', this.onDeviceOrientation)
      this.detectionTimer = setTimeout(this.onOrientationTimer, this.supportDelay)
    } else if (this.motionSupport) {
      this.portrait = false
      window.addEventListener('devicemotion', this.onDeviceMotion)
      this.detectionTimer = setTimeout(this.onMotionTimer, this.supportDelay)
    } else {
      this.calibrationX = 0
      this.calibrationY = 0
      this.portrait = false
      window.addEventListener('mousemove', this.onMouseMove)
      this.doReadyCallback()
    }

    window.addEventListener('resize', this.onWindowResize)
    this.raf = rqAnFr(this.onAnimationFrame)
  }

  /**
   * Disable the Parallax scene
   */
  disable(): void {
    if (!this.enabled) {
      return
    }
    this.enabled = false

    if (this.orientationSupport) {
      window.removeEventListener('deviceorientation', this.onDeviceOrientation)
    } else if (this.motionSupport) {
      window.removeEventListener('devicemotion', this.onDeviceMotion)
    } else {
      window.removeEventListener('mousemove', this.onMouseMove)
    }

    window.removeEventListener('resize', this.onWindowResize)
    rqAnFr.cancel(this.raf)
  }

  calibrate(x: number, y: number): void {
    this.calibrateX = x === undefined ? this.calibrateX : x
    this.calibrateY = y === undefined ? this.calibrateY : y
  }

  invert(x: number, y: number): void {
    this.invertX = x === undefined ? this.invertX : x
    this.invertY = y === undefined ? this.invertY : y
  }

  friction(x: number, y: number): void {
    this.frictionX = x === undefined ? this.frictionX : x
    this.frictionY = y === undefined ? this.frictionY : y
  }

  scalar(x: number, y: number): void {
    this.scalarX = x === undefined ? this.scalarX : x
    this.scalarY = y === undefined ? this.scalarY : y
  }

  limit(x: number, y: number): void {
    this.limitX = x === undefined ? this.limitX : x
    this.limitY = y === undefined ? this.limitY : y
  }

  origin(x: number, y: number): void {
    this.originX = x === undefined ? this.originX : x
    this.originY = y === undefined ? this.originY : y
  }

  setInputElement(element: HTMLElement): void {
    this.inputElement = element
    this.updateDimensions()
  }

  setPosition(element: HTMLElement, x: number, y: number): void {
    let positionX: string = x.toFixed(this.precision) + 'px'
    let positionY: string = y.toFixed(this.precision) + 'px'
    if (this.transform3DSupport) {
      helpers.css(element, 'transform', 'translate3d(' + positionX + ',' + positionY + ',0)')
    } else if (this.transform2DSupport) {
      helpers.css(element, 'transform', 'translate(' + positionX + ',' + positionY + ')')
    } else {
      element.style.left = positionX
      element.style.top = positionY
    }
  }

  onOrientationTimer(): void {
    if (this.orientationSupport && this.orientationStatus === 0) {
      this.disable()
      this.orientationSupport = false
      this.enable()
    } else {
      this.doReadyCallback()
    }
  }

  onMotionTimer(): void {
    if (this.motionSupport && this.motionStatus === 0) {
      this.disable()
      this.motionSupport = false
      this.enable()
    } else {
      this.doReadyCallback()
    }
  }

  onCalibrationTimer(): void {
    this.calibrationFlag = true
  }

  onWindowResize(): void {
    this.updateDimensions()
  }

  onAnimationFrame(): void {
    // Compress these if you'd like, having them uncompressed like this seems easier to read
    if(!this.inputX) return;
    if(!this.inputY) return;
    if(!this.calibrationX) return;
    if(!this.calibrationY) return;
    if(!this.calibrationThreshold) return;
    if(!this.elementWidth) return;
    if(!this.elementHeight) return;
    if(!this.limitX) return;
    if(!this.limitY) return;
    if(!this.scalarX) return;
    if(!this.scalarY) return;
    if(!this.velocityX) return;
    if(!this.velocityY) return;
    if(!this.depthsX) return;
    if(!this.depthsY) return;
    if(!this.frictionX) return;
    if(!this.frictionY) return;

    if(!(this.layers && this.layers.length)) return; // If there are no layers to animate, we don't need to do all this calculation

    this.updateBounds()
    let calibratedInputX = this.inputX - this.calibrationX,
        calibratedInputY = this.inputY - this.calibrationY
    if ((Math.abs(calibratedInputX) > this.calibrationThreshold) || (Math.abs(calibratedInputY) > this.calibrationThreshold)) {
      this.queueCalibration(0)
    }
    if (this.portrait) {
      this.motionX = this.calibrateX ? calibratedInputY : this.inputY
      this.motionY = this.calibrateY ? calibratedInputX : this.inputX
    } else {
      this.motionX = this.calibrateX ? calibratedInputX : this.inputX
      this.motionY = this.calibrateY ? calibratedInputY : this.inputY
    }
    this.motionX *= this.elementWidth * (this.scalarX / 100)
    this.motionY *= this.elementHeight * (this.scalarY / 100)
    if (!isNaN(this.limitX)) {
      this.motionX = helpers.clamp(this.motionX, -this.limitX, this.limitX)
    }
    if (!isNaN(this.limitY)) {
      this.motionY = helpers.clamp(this.motionY, -this.limitY, this.limitY)
    }
    this.velocityX += (this.motionX - this.velocityX) * this.frictionX
    this.velocityY += (this.motionY - this.velocityY) * this.frictionY

    for (let index = 0; index < this.layers.length; index++) {
      let layer = this.layers[index],
          depthX = this.depthsX[index],
          depthY = this.depthsY[index],
          xOffset = this.velocityX * (depthX * (this.invertX ? -1 : 1)),
          yOffset = this.velocityY * (depthY * (this.invertY ? -1 : 1))
      this.setPosition(layer, xOffset, yOffset)
    }
    this.raf = rqAnFr(this.onAnimationFrame)
  }

  rotate(beta: number, gamma: number): void {
    if(!this.windowHeight) return;
    if(!this.windowWidth) return;

    // Extract Rotation
    let x = (beta || 0) / MAGIC_NUMBER, //  -90 :: 90
        y = (gamma || 0) / MAGIC_NUMBER // -180 :: 180

    // Detect Orientation Change
    let portrait = this.windowHeight > this.windowWidth
    if (this.portrait !== portrait) {
      this.portrait = portrait
      this.calibrationFlag = true
    }

    if (this.calibrationFlag) {
      this.calibrationFlag = false
      this.calibrationX = x
      this.calibrationY = y
    }

    this.inputX = x
    this.inputY = y
  }

  onDeviceOrientation(event: DeviceOrientationEvent): void {
    let beta = event.beta
    let gamma = event.gamma
    if (beta !== null && gamma !== null) {
      this.orientationStatus = 1
      this.rotate(beta, gamma)
    }
  }

  onDeviceMotion(event: DeviceMotionEvent): void {

    let beta = event?.rotationRate?.beta
    let gamma = event?.rotationRate?.gamma

    if(!beta) return;
    if(!gamma) return;

    if (beta !== null && gamma !== null) {
      this.motionStatus = 1
      this.rotate(beta, gamma)
    }
  }

  onMouseMove(event: MouseEvent): void {
    if(!this.elementPositionX) return;
    if(!this.elementPositionY) return;
    if(!this.elementCenterX) return;
    if(!this.elementCenterY) return;
    if(!this.elementWidth) return;
    if(!this.elementHeight) return;
    if(!this.windowCenterX) return;
    if(!this.windowCenterY) return;

    let clientX = event.clientX,
        clientY = event.clientY

    // reset input to center if hoverOnly is set and we're not hovering the element
    if(this.hoverOnly &&
      ((clientX < this.elementPositionX || clientX > this.elementPositionX + this.elementWidth) ||
      (clientY < this.elementPositionY || clientY > this.elementPositionY + this.elementHeight))) {
        this.inputX = 0
        this.inputY = 0
        return
      }

    if (this.relativeInput) {
      // Clip mouse coordinates inside element bounds.
      if (this.clipRelativeInput) {
        clientX = Math.max(clientX, this.elementPositionX)
        clientX = Math.min(clientX, this.elementPositionX + this.elementWidth)
        clientY = Math.max(clientY, this.elementPositionY)
        clientY = Math.min(clientY, this.elementPositionY + this.elementHeight)
      }
      // Calculate input relative to the element.
      if(this.elementRangeX && this.elementRangeY) {
        this.inputX = (clientX - this.elementPositionX - this.elementCenterX) / this.elementRangeX
        this.inputY = (clientY - this.elementPositionY - this.elementCenterY) / this.elementRangeY
      }
    } else {
      // Calculate input relative to the window.
      if(this.windowRadiusX && this.windowRadiusY) {
        this.inputX = (clientX - this.windowCenterX) / this.windowRadiusX
        this.inputY = (clientY - this.windowCenterY) / this.windowRadiusY
      }
    }
  }

  destroy(): void {
    this.disable()

    if(!(this.element && this.layers)) return

    clearTimeout(this.calibrationTimer)
    clearTimeout(this.detectionTimer)

    this.element.removeAttribute('style')
    for (let index = 0; index < this.layers.length; index++) {
      this.layers[index].removeAttribute('style')
    }

    delete this.element
    delete this.layers
  }

  version() {
    return '3.1.0'
  }

}