let THREECAMERA = null;
let threeStuffs = null;
let actualModel = null;
let loaded = true;

const errorsInit = {
  // Erros internos para serem tratados
  "ALREADY_INITIALIZED": "Erro interno: A API já foi inicializada",
  "NO_CANVASID": "Erro interno: Nenhuma tela ou ID de tela foi especificado",
  "INVALID_CANVASID": "Erro interno: Não foi possível encontrar o elemento DOM do <canvas>",
  "INVALID_CANVASDIMENSIONS": "Erro interno: As dimensões de largura e altura da tela não foram especificadas",
  "GLCONTEXT_LOST": "Erro interno: O contexto WebGL foi perdido. Se o contexto for perdido após a inicialização, a função callbackReady será lançada uma segunda vez com este valor como código de erro",
  "MAXFACES_TOOHIGH": "Erro interno: O número máximo de faces detectadas e rastreadas, especificado pelo argumento init opcional maxFacesDetected, é muito alto.",

  // Erros no lado do cliente
  "GL_INCOMPATIBLE": "WebGL não está disponível ou esta configuração WebGL não é suficiente (não há WebGL2 ou há WebGL1 sem extensão OES_TEXTURE_FLOAT ou OES_TEXTURE_HALF_FLOAT)",
  "WEBCAM_UNAVAILABLE": "Não foi possível acessar a camera do dispositivo. (este dispositivo não possui camera ou não aceitou compartilhar, ou a camera está ocupada)",
};

const setLoader = (isLoading) => {
  const spinner = document.getElementById('spinner-container');
  if (isLoading) {
    spinner.style.visibility = "visible";
  } else {
    spinner.style.visibility = "hidden";
  }  
};

export function changeModel(modelPath) {
  if (loaded) {
    
    setLoader(true);
    loaded = false;

    console.log(`modelPath ${modelPath}`);
    const SETTINGS = {
      gltfModelURL: modelPath,
      offsetXYZ: [0, 0, 0],
      scale: 1.60
    };
    
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('./public/libs/draco');

    const gltfLoader = new THREE.GLTFLoader();

    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load( SETTINGS.gltfModelURL, function ( gltf ) {
      gltf.scene.frustumCulled = false;

      const bbox = new THREE.Box3().expandByObject(gltf.scene);
      const sizeY = bbox.getSize(new THREE.Vector3()).y;
      gltf.scene.position.add(new THREE.Vector3(SETTINGS.offsetXYZ[0], SETTINGS.offsetXYZ[1]+sizeY, SETTINGS.offsetXYZ[2]));
      const sizeX = bbox.getSize(new THREE.Vector3()).x;

      gltf.scene.scale.multiplyScalar(SETTINGS.scale / sizeX);

      const occluderMesh = new THREE.Mesh();
      gltfLoader.load( './public/models/face/faceMask.glb', function ( mask ) {
        mask.scene.traverse( function ( childMask ) {
          if ( childMask.isMesh ) {
            const mat = new THREE.ShaderMaterial({
              vertexShader: THREE.ShaderLib.basic.vertexShader,
              fragmentShader: "precision lowp float;\n void main(void){\n gl_FragColor=vec4(1.,0.,0.,1.);\n }",
              uniforms: THREE.ShaderLib.basic.uniforms,
              colorWrite: false
            });
            
            occluderMesh.renderOrder = -1;
            occluderMesh.material = mat;            
            occluderMesh.geometry = childMask.geometry;
          }
        });        
        occluderMesh.position.add(new THREE.Vector3(SETTINGS.offsetXYZ[0], SETTINGS.offsetXYZ[1]+sizeY, SETTINGS.offsetXYZ[2]));
        occluderMesh.scale.multiplyScalar(SETTINGS.scale / sizeX);
        threeStuffs.faceObject.add(occluderMesh);
      });

      if(actualModel) {
        threeStuffs.faceObject.remove(actualModel);
        threeStuffs.faceObject.remove(occluderMesh);        
      }
      actualModel = gltf.scene;
      threeStuffs.faceObject.add(actualModel);
      threeStuffs.faceObject.add(occluderMesh);
      loaded = true; 
      setLoader(false);
    },
    function ( xhr ) {
      console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
    },
    function ( err ) {
      setLoader(false);
      alert("Ops, ocorreu um erro, tente reiniciar a página");
      console.error(err);
    }); 
  } 
}

function init_threeScene(spec){
  threeStuffs = THREE.JeelizHelper.init(spec, null);
  threeStuffs.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  threeStuffs.renderer.outputEncoding = THREE.sRGBEncoding;
  threeStuffs.renderer.physicallyCorrectLights = true;
  console.log("init_threeScene");
  THREECAMERA = THREE.JeelizHelper.create_camera();
  setLoader(false);
}

export function main(){
  JeelizResizer.size_canvas({
    canvasId: 'faceFilterCanvas',
    isFullScreen: true,
    callback: start,
    onResize: function(){
      console.log("onResize");
      THREE.JeelizHelper.update_camera(THREECAMERA);
    }
  });
}

function start(){
  JEEFACEFILTERAPI.init({ 
    followZRot: true,
    videoSettings:{ 
      'idealWidth': 1280,
      'idealHeight': 800,
      'maxWidth': 1920,
      'maxHeight': 1920, 
      flipX: true, 
    },
    canvasId: 'faceFilterCanvas',
    followZRot: true,
    maxFacesDetected: 1,
    NNCpath: './public/dist/NNCviewTop.json',
    callbackReady: function(errCode, spec){   
      console.log("callbackReady");
      JEEFACEFILTERAPI.toggle_slow(true);
      if (errorsInit[errCode]){  
        alert(errorsInit[errCode]);
        console.error(errCode);
        return;
      }else if (errCode){  
        alert(`Ops, ocorreu um erro, tente reiniciar a página ${errCode}`);
        console.error(errCode);
        return;
      }
      init_threeScene(spec);
    },
    callbackTrack: function(detectState){
      console.log("callbackTrack");
      
      THREE.JeelizHelper.render(detectState, THREECAMERA);
    }
  });
}