# Coral Detector

This project detects corals  in underwater images using SAM and Mask R-CNN. It helps marine researchers automate coral annotation and improve conservation workflows.

---

## Programming stacks

- **Frontend**: React, Next.js, Tailwind CSS  
- **Backend**: Python, Flask

---

### Clone the repo
git clone https://github.com/clcik-click/CIS673_Project.git

### Navigate to the project directory
cd CIS673_Project


CIS673_Project/

├── back-end/              
│       ├── SAM_models/         # You have to download the SAM models separately

│       └── app.py              # Flask server

├── Corals/                 # Coral image data

├── front-end/              # React + Next.js + Tailwind frontend

└── README.md               # This file         

### front-end
cd .\front-end\
npm run dev

### back-end
cd .\back-end\
python app.py

### back-end libraries
pip install flask flask-cors segment-anything torch torchvision scikit-image matplotlib pandas opencv-python numpy
