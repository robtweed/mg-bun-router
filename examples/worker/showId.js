const handler = function(messageObj, finished) {

  finished({
    handled_in_worker: messageObj.data.params.id,
    worker: {
      id: this.id,
      pid: process.pid
    }
  });
}
export {handler};
