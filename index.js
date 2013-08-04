
var Rx = require('rx');
var _ = require('lodash');
var fs = require('fs');

var Observable = Rx.Observable;
var observableProto = Observable.prototype;

function a(fn, len) {
	return function() {
		return fn.apply(null, _.take(arguments, len))
	}
};
function i() { return arguments[0]; };
function setFullPath(a, b) { return a + '/' + b; }

function getFilenameMetaData(path) {
	
	var slash = Math.max(path.lastIndexOf('/'), 0),
		dot = path.lastIndexOf('.');
	
	return {
		extension: path.substring(dot),
		name:      path.substring(slash, dot),
		location:  path.substring(0, slash),
		path:      path
	}
};

// 
// Unlinks the files in a directory then deletes the directory.
// 
function cleardir(path) {
	
	var unlink = unlinkdir(path),
		rmdir  = rmdir(path);
	
	return unlink.concat(rmdir);
};

// 
// Recursively asynchronously enumerates the descendent
// files and directories of the given root directory.
// 
function expanddir(dir) {
	
	return ls(dir)
		.expand(function(x) {
			return x.stat.isFile() ?
				Observable.empty() :
				ls(x.path)
		})
		.where(function(x) {
			return x.stat;
		})
		.select(function(x) {
			return x.stat.isFile() ? getFilenameMetaData(x.path) : x;
		});
};

// 
// Recursively asynchronously enumerates the descendent
// files with the specified extension of the given root directory.
// 
function expandfiles(dir, ext, encoding) {
	
	if(encoding === void(0)) encoding = 'utf-8';
	
	return expanddir(dir)
		.whereFile(ext)
		.selectMany(function(x) {
			return readfile(x.path, encoding)
				.select(function(y) {
					y.stat = x.stat;
					return y;
				});
		});
};

// 
// Asynchronously list the file stats of a directory.
// 
function ls(dir) {
	
	return readdir(dir)
		.selectMany(a(stats, 1));
};

// 
// Asynchronously make the directory at the specified path.
// Automatically completes if the directory already exists.
// 
function mkdir(path) {
	
	return Rx.Observable.create(function(observer){
		
		fs.exists(path, checkExistence);
		
		function complete(e) {
			if(e) return observer.onError(e);
			observer.onNext(path);
			observer.onCompleted();
		};
		
		function checkExistence(exists) {
			return exists ?
				complete() :
				fs.mkdir(path, complete);
		};
	});
};

// 
// Recursively asynchronously unlinks all the files and
// deletes all the directories in the given directory.
// 
function nukedir(dir) {
	
	return expanddir(dir)
		.whereDirectory()
		.selectMany(function(x) {
			return cleardir(x.path);
		});
};

// 
// Asynchronously reads the files in the directory as an Array.
// 
function readdir(dir) {
	
	return Rx.Observable.create(function(observer) {
		
		fs.readdir(dir, cb);
		
		function cb(e, files) {
			if(e) files = [];
			files = _.map(files, _.partial(setFullPath, dir));
			observer.onNext(files);
			observer.onCompleted();
		}
	});
};

// 
// Asynchronously reads the file at the path.
// 
function readfile(path, encoding) {
	
	if(encoding === void(0)) encoding = 'utf-8';
	
	return Rx.Observable.create(function(observer) {
		
		fs.readfile(path, encoding, cb);
		
		function cb(e, file) {
			if(e) return observer.onError(e);
			
			var data = getFilenameMetaData(path || '');
			data.file = file;
			observer.onNext(data);
			observer.onCompleted();
		};
	});
};


// 
// Enumerates the files from a directory that match an extension.
// 
function readfiles(dir, ext, encoding) {
	
	if(encoding === void(0)) encoding = 'utf-8';
	
	return readdir(dir)
		.whereFile(ext)
		.selectMany(function(x) {
			return readfile(x.path, encoding)
				.select(function(y) {
					y.stat = x.stat;
					return y;
				});
		});
};

// 
// Asynchronously removes the directory.
// 
function rmdir(dir) {
	
	return Rx.Observable.create(function(observer){
		
		fs.rmdir(dir, cb);
		
		function cb(e) {
			
			if(e) return observer.onError(e);
			
			observer.onNext(path);
			observer.onCompleted();
		}
	});
};

// 
// Asynchronously reads the stats of the item at the path.
// 
function stat(path) {
	
	return Rx.Observable.create(function(observer) {
		
		fs.stat(path, cb);
		
		function cb(e, stat) {
			if(e) return observer.onError(e);
			
			var data = getFilenameMetaData(path || '');
			data.stat = stat;
			observer.onNext(data);
			observer.onCompleted();
		}
	});
};

// 
// Asynchronously enumerates the stats of the argument paths.
// 
function stats() {
	
	var files = _.flatten(arguments);
	var stats = _.map(files, stat);
	return Rx.Observable.concat(stats);
};

// 
// Asynchronously unlinks the file at the given path.
// 
function unlink(path) {
	
	return Rx.Observable.create(function(observer){
		
		fs.unlink(path, cb);
		
		function cb(e) {
			if(e) return observer.onError(e);
			
			observer.onNext(path);
			observer.onCompleted();
		}
	});
};

// 
// Unlinks all the files in a directory.
// Optionally accepts a file extension to match.
// 
function unlinkdir(dir, ext) {
	
	return ls(dir)
		.whereFile(ext)
		.unlink();
};

// 
// Writes the file to the path.
// Creates any directories in the path that don't already exist.
// 
function writeFile(path, file) {
	
	// Create any directories that don't exist before writing the file.
	var dirs = path.split('/');
	if(dirs[0] === '.') dirs.pop();
	
	var makeDirsObs = Rx.Observable.fromArray(dirs)
		.scan(setFullPath)
		.selectMany(mkdir)
		.onErrorResumeNext(Observable.empty());
	
	var writeFileObs = Rx.Observable.create(function(observer){
		
		fs.writeFile(path, file, cb);
		
		function cb(e) {
			if(e) return observer.onError(e);
			
			var data = getFilenameMetaData(path);
			data.file = file;
			
			observer.onNext(data);
			observer.onCompleted();
		}
	});
	
	return makeDirsObs.concat(writeFileObs);
};

// 
// Narrows results to include only directories.
// 
observableProto.whereDirectory = function() {
	return this.where(function(x) {
		return x.stat && x.stat.isDirectory();
	});
};

// 
// Narrows results to include only files.
// 
observableProto.whereFile = function(ext) {
	return this.where(function(x) {
		
		var isFile = x.stat && x.stat.isFile();
		
		return ext ?
			x.extension === ext && isFile :
			isFile;
	});
};

// 
// Removes the enumerated files.
// 
observableProto.unlink = function() {
	return this.selectMany(function(x) {
		return unlink(x.path);
	});
};

// 
// Reads the file at each enumerated path.
// 
observableProto.readfile = function(encoding) {
	
	if(encoding === void(0)) encoding = 'utf-8';
	
	return this.selectMany(_.partialRight(readfile, encoding));
};

// 
// Reads the files of each enumerated directory path.
// 
observableProto.readfiles = function(encoding) {
	
	if(encoding === void(0)) encoding = 'utf-8';
	
	return this.selectMany(_.partialRight(readfiles, encoding));
};

// Removes the enumerated directories.
observableProto.rmdir = function() {
	return this.selectMany(rmdir);
}

// 
// Writes the enumerated files, choosing the name
// and data from the filename and data selectors.
// 
observableProto.writeFiles = function(pathSelector, dataSelector) {
	if(dataSelector === void(0)) dataSelector = i;
	
	return this.selectMany(function(x) {
		var path = pathSelector(x);
		var data = dataSelector(x);
		
		return writeFile(path, data);
	});
}

Rx.fs = {
	cleardir: cleardir,
	expanddir: expanddir,
	expandfiles: expandfiles,
	ls: ls,
	mkdir: mkdir,
	nukedir: nukedir,
	readdir: readdir,
	readfile: readfile,
	readfiles: readfiles,
	rmdir: rmdir,
	stat: stat,
	stats: stats,
	unlink: unlink,
	unlinkdir: unlinkdir,
	writeFile: writeFile
};

module.exports = Rx;
