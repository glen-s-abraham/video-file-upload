const uploadBtn=document.querySelector('#upload-btn');

const uploadFiles = (()=>{
    const fileRequests = new WeakMap();
    const defaultOptions = {
        url:'/',
        onAbort(){},
        onError(){},
        onProgress(){},
        onComplete(){}

    }

    const uploadFile = (file,options)=>{

        const req = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file',file,file.name);
        req.open('POST',options.url,true);
        req.onload = (evt)=>options.onComplete(evt,file);
        req.onerror= (evt)=>options.onError(evt,file);
        req.ontimeout=(evt)=>options.onError(evt,file);
        req.upload.onprogress=(evt)=>options.onProgress(evt,file);
        req.onabort=(evt)=>options.onAbort(evt,file);
        fileRequests.set(file,{request:req,options});
        req.send(formData);
    }

    const abortFileUpload = file =>{
        const fileReq = fileRequests.get(file);
        if(fileReq){
            fileReq.request.abort();
        }
    }

    const clearFileUpload = file =>{
        abortFileUpload(file);
        fileRequests.delete(file);
    }

    return (files,options=defaultOptions)=>{
        [...files].forEach(file=>uploadFile(file,{...defaultOptions,...options}));

        return {
            abortFileUpload,
            clearFileUpload
        }
    }
})();

//for ui
const uploadAndTrackFiles=(()=>{
    let uploader = {}
    const FILE_STATUS = {
        PENDING:'pending',
        UPLOADING:'uploading',
        PAUSED:'paused',
        COMPLETED:'completed',
        FAILED:'failed'
    }

    const files = new Map();
    const progressBox = document.createElement('div');
    progressBox.className = 'upload-progress-tracker';
    progressBox.innerHTML = `
        <h3>Upload</h3>
        <div class = 'file-progress-wrapper'></div>
    `
   
    const setFileElement = (file)=>{
        const fileElement = document.createElement('div');
        fileElement.className = 'upload-progress-tracker';
        fileElement.innerHTML = `
        <div class='file-details'>
            <p>
                <span class='file-name'>${file.name} </span>
                <span class='file-status'>${FILE_STATUS.PENDING}</span>
            </p>
            <div class = 'progress-bar' style="width:0;height:2px;background:green;"></div>
        </div>
        <div class = 'file-action'>
            <button type='button' class='pause-btn'>Pause</button>
        </div>
        `;
        files.set(file,{
            fileElement,
            status:FILE_STATUS.PENDING,
            size:file.size,
            percentage:0,
        })

        const [,{children:[pauseBtn]}] = fileElement.children;
        pauseBtn.addEventListener('click',(evt)=>{
           uploader.abortFileUpload(file); 
        })
        progressBox.querySelector('.file-progress-wrapper').appendChild(fileElement);
    }
    const updateFileElement = fileObj =>{
        console.log(fileObj.fileElement);
        const [{children: [{children: [fileName,fileStatus]}, progressBar]}] = fileObj.fileElement.children;
        requestAnimationFrame(()=>{
            fileStatus.textContent = fileObj.status;
            fileStatus.className =`status ${fileObj.status}`;
            progressBar.style.width = fileObj.percentage+'%';
        })
    }
    const onProgress = (evt,file)=>{
        const fileObj = files.get(file);
        fileObj.status = FILE_STATUS.UPLOADING;
        fileObj.percentage = evt.loaded *100 /evt.total;
        updateFileElement(fileObj);
    }
    const onError = (evt,file)=>{
        const fileObj = files.get(file);
        fileObj.status = FILE_STATUS.FAILED;
        fileObj.percentage = 100;
        updateFileElement(fileObj);
    }
    const onAbort = (evt,file)=>{
        const fileObj = files.get(file);
        fileObj.status = FILE_STATUS.PAUSED
        updateFileElement(fileObj);
    }
    const onComplete = (evt,file)=>{
        fileObj.status = FILE_STATUS.COMPLETED
        updateFileElement(fileObj);
    }
    return(uploadedFiles)=>{
        [...uploadedFiles].forEach(setFileElement);
        document.body.appendChild(progressBox);
        uploader=uploadFiles(uploadedFiles,{
            path:'http://localhost:8080/upoad',
            onComplete,
            onAbort,
            onError,
            onProgress
        });
        
    }
})();

uploadBtn.addEventListener('change',(evt)=>{
    uploadAndTrackFiles(evt.target.files);
})