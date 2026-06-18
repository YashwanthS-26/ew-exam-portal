const fs = require('fs');
const path = require('path');

const dir = 'c:\\Business\\exam\\ew-exam-portal\\stitch-mockups';
if (!fs.existsSync(dir)){
    fs.mkdirSync(dir, { recursive: true });
}

const files = [
    { name: 'e5af6127c5a74d5ba8f8c0fcbabdeea7.html', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzNmZmE2MWQ1MzJiNTQ4NmM4YWM5OWM4N2QyOGM0NzIxEgsSBxDpz6ja_RIYAZIBIwoKcHJvamVjdF9pZBIVQhM5Nzg2NjY1OTUzMTE2OTY1OTc2&filename=&opi=89354086' },
    { name: '03afb7b4632e48fb89836b444285cb0c.html', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzRkMWQzN2QzOTU2NDRlZGY5NzA4ZDBkZjRhOTRjODA3EgsSBxDpz6ja_RIYAZIBIwoKcHJvamVjdF9pZBIVQhM5Nzg2NjY1OTUzMTE2OTY1OTc2&filename=&opi=89354086' },
    { name: '961cd776cf404264be90f31e51db8437.html', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2FlNTkyZDk3MzE3MTQyZjE5MGE1YjRmYzVhOGExNmM2EgsSBxDpz6ja_RIYAZIBIwoKcHJvamVjdF9pZBIVQhM5Nzg2NjY1OTUzMTE2OTY1OTc2&filename=&opi=89354086' },
    { name: '758df258c368444fb1732420c6a274d3.html', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzg2ZThkZTY5OTJhNzRlYjdiNjc4ZDVkOGMxMDJjZGNkEgsSBxDpz6ja_RIYAZIBIwoKcHJvamVjdF9pZBIVQhM5Nzg2NjY1OTUzMTE2OTY1OTc2&filename=&opi=89354086' },
    { name: '8400eead672b4f71aa488d35e4c10ba6.html', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2ZiNDI4ZDE3ZjNjNzRmNDJhNGJkMDJiYjQxNzZhZjU1EgsSBxDpz6ja_RIYAZIBIwoKcHJvamVjdF9pZBIVQhM5Nzg2NjY1OTUzMTE2OTY1OTc2&filename=&opi=89354086' },
    { name: '95704732db6e4dabb0676763e994d691.html', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzhiODIzZDU4YmEzZTRmMDhhMTA4MWE0Mzk5MzRkODM5EgsSBxDpz6ja_RIYAZIBIwoKcHJvamVjdF9pZBIVQhM5Nzg2NjY1OTUzMTE2OTY1OTc2&filename=&opi=89354086' },
    { name: 'dc877efdd4ef4022b84f02fe85283bc3.html', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzgzMDhjYzVkOTI2NTQ2YzRhOTU4OWUxMzgzZTI3NGZjEgsSBxDpz6ja_RIYAZIBIwoKcHJvamVjdF9pZBIVQhM5Nzg2NjY1OTUzMTE2OTY1OTc2&filename=&opi=89354086' },
    { name: 'd4073f2bdc3a4be6b62c4428960dc928.html', url: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzNhMTBmYjYwMzVkYjRmM2NhZjU3ZjM5YzFhNjMxOWEyEgsSBxDpz6ja_RIYAZIBIwoKcHJvamVjdF9pZBIVQhM5Nzg2NjY1OTUzMTE2OTY1OTc2&filename=&opi=89354086' }
];

async function downloadFiles() {
    for (let file of files) {
        console.log('Downloading ' + file.name + '...');
        try {
            const response = await fetch(file.url);
            if (!response.ok) {
                console.error('Failed to download ' + file.name + ': ' + response.statusText);
                continue;
            }
            const text = await response.text();
            fs.writeFileSync(path.join(dir, file.name), text);
            console.log('Saved ' + file.name);
        } catch (e) {
            console.error('Error downloading ' + file.name, e);
        }
    }
}
downloadFiles();
