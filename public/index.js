const uploadBtn=document.querySelector('#upload-btn');

const uploadFiles = (()=>{
    const fileRequests = new WeakMap();
    const defaultOptions = {
        path:'/',
        fileId:null,
        startingBytes:0,
        onAbort(){},
        onError(){},
        onProgress(){},
        onComplete(){}

    }

    const uploadFileChunks=(file,options)=>{
        console.log(options)
        const req = new XMLHttpRequest();
        const formData = new FormData();
        const chunk = file.slice(options.startingBytes);
        
        formData.append('chunk',chunk,file.name);
        formData.append('fileId',options.fileId);
        req.open('POST',options.path,true);
        req.setRequestHeader('X-File-Id',options.fileId);
        req.setRequestHeader('Content-Range',
            `bytes=${options.startingBytes}-${options.startingBytes+chunk.size}/${file.size}`
        );
        req.onload = (evt)=>options.onComplete(evt,file);
        req.onerror= (evt)=>options.onError(evt,file);
        req.ontimeout=(evt)=>options.onError(evt,file);
        req.upload.onprogress=(evt)=>{
            const loaded = options.startingBytes+evt.loaded;
            options.onProgress({...evt,loaded,total:file.size},file)
        };
        req.onabort=(evt)=>options.onAbort(evt,file);
        fileRequests.get(file).request = req
        req.send(formData);
    }

    const uploadFile = (file,options)=>{
        fetch('http://localhost:8080/upload-request',{
            method:'POST',
            headers:{
                'Content-Type':'application/json'
            },
            body:JSON.stringify({fileName:file.name})
        })
        .then(res=>res.json())
        .then(res=>{
            options = {...options,fileId:res.fileId};
            fileRequests.set(file,{request:null,options})
            uploadFileChunks(file,{...options,fileId:res.fileId});
        })
    }

    const abortFileUpload = file =>{
        const fileReq = fileRequests.get(file);
        if(fileReq){
            fileReq.request.abort();
        }
    }

    const resumeFileUpload = file => {
		const fileReq = fileRequests.get(file);
		
		if (fileReq) {
			return fetch(`http://localhost:8080/upload-status?fileName=${file.name}&fileId=${fileReq.options.fileId}`)
				.then(res => res.json())
				.then(res => {
					uploadFileChunks(file, {...fileReq.options, startingBytes: Number(res.totalChunksUploaded)});
				})
				.catch(e => {
					fileReq.options.onError({...e, file})
				})
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
            clearFileUpload,
            resumeFileUpload
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
            <button type='button' class='resume-btn'>Resume</button>
        </div>
        `;
        files.set(file,{
            fileElement,
            status:FILE_STATUS.PENDING,
            size:file.size,
            percentage:0,
        })

        const [,{children:[pauseBtn,resumeBtn]}] = fileElement.children;
        pauseBtn.addEventListener('click',(evt)=>{
           uploader.abortFileUpload(file); 
        })
        resumeBtn.addEventListener('click',(evt)=>{
            uploader.resumeFileUpload(file); 
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
        console.log(evt);
        console.log(file);
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
        const fileObj = files.get(file);
        fileObj.status = FILE_STATUS.COMPLETED
        updateFileElement(fileObj);
    }
    return(uploadedFiles)=>{
        [...uploadedFiles].forEach(setFileElement);
        document.body.appendChild(progressBox);
        uploader=uploadFiles(uploadedFiles,{
            path:'http://localhost:8080/upload',
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